<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\RscServicePrincipal;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

final class IssueRscServiceToken extends Command
{
    protected $signature = 'logiflow:rsc-token
        {action : One of issue, list, or revoke}
        {id? : Personal access token ID for revoke}
        {--tenant= : Tenant slug or numeric ID}
        {--global : Issue a token for the global RSC service principal (all tenants)}
        {--name= : Token name for issue}
        {--abilities= : Comma-separated subset of the default RSC abilities}
        {--all : Revoke all tokens for the selected tenant}
        {--force : Skip the revoke confirmation prompt}';

    protected $description = 'Issue, list, or revoke tenant-scoped RSC service tokens';

    public function __construct(
        private readonly RscServicePrincipal $servicePrincipal,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $action = strtolower((string) $this->argument('action'));
        $tokenId = $this->argument('id');

        Log::info('RSC service token command invoked', [
            'subcommand' => $action,
            'operator' => $this->operator(),
            'timestamp' => now()->toIso8601String(),
            'token_id' => $action === 'revoke' ? $tokenId : null,
        ]);

        try {
            return match ($action) {
                'issue' => $this->issue(),
                'list' => $this->listTokens(),
                'revoke' => $this->revoke($tokenId),
                default => $this->userError('Unknown action. Use issue, list, or revoke.'),
            };
        } catch (Throwable $exception) {
            report($exception);
            $this->errorOutput('Unexpected failure while managing the RSC service token.');

            return 2;
        }
    }

    private function issue(): int
    {
        $global = (bool) $this->option('global');

        if (! $global && ! $this->option('tenant')) {
            return $this->userError('Either --tenant or --global must be supplied.');
        }

        if ($global) {
            $abilities = $this->abilities();
            if ($abilities === null) {
                return 1;
            }

            $user = $this->servicePrincipal->ensureGlobal();
            $name = (string) ($this->option('name') ?: 'rsc-global-' . now()->format('Ymd-His'));
            $token = $user->createToken($name, $abilities);

            $this->output->writeln($token->plainTextToken);
            $this->errorOutput('Copy this token now; it will never be shown again.');

            return 0;
        }

        $tenant = $this->tenant();
        if ($tenant === null) {
            return 1;
        }

        $abilities = $this->abilities();
        if ($abilities === null) {
            return 1;
        }

        $user = $this->servicePrincipal->ensureForTenant($tenant);
        $name = (string) ($this->option('name') ?: 'rsc-' . now()->format('Ymd-His'));
        $token = $user->createToken($name, $abilities);

        $this->output->writeln($token->plainTextToken);
        $this->errorOutput('Copy this token now; it will never be shown again.');

        return 0;
    }

    private function listTokens(): int
    {
        $global = (bool) $this->option('global');

        if (! $global && ! $this->option('tenant')) {
            return $this->userError('Either --tenant or --global must be supplied.');
        }

        if ($global) {
            $user = $this->servicePrincipal->findGlobal();
            if ($user === null) {
                return $this->userError('The global RSC service principal does not exist.');
            }
        } else {
            $tenant = $this->tenant();
            if ($tenant === null) {
                return 1;
            }

            $user = $this->servicePrincipal->findForTenantLegacy($tenant);
            if ($user === null) {
                return $this->userError('The RSC service principal does not exist for this tenant.');
            }
        }

        $this->table(
            ['id', 'name', 'abilities', 'created_at', 'last_used_at'],
            $user->tokens()->get()->map(static fn($token): array => [
                $token->id,
                $token->name,
                implode(',', $token->abilities ?? []),
                $token->created_at?->toIso8601String(),
                $token->last_used_at?->toIso8601String(),
            ])->all(),
        );

        return 0;
    }

    private function revoke(mixed $tokenId): int
    {
        $global = (bool) $this->option('global');

        if (! $global && ! $this->option('tenant')) {
            return $this->userError('Either --tenant or --global must be supplied.');
        }

        if ($global) {
            $user = $this->servicePrincipal->findGlobal();
            if ($user === null) {
                return $this->userError('The global RSC service principal does not exist.');
            }
        } else {
            $tenant = $this->tenant();
            if ($tenant === null) {
                return 1;
            }

            $user = $this->servicePrincipal->findForTenantLegacy($tenant);
            if ($user === null) {
                return $this->userError('The RSC service principal does not exist for this tenant.');
            }
        }

        if ((bool) $this->option('all')) {
            if ($tokenId !== null) {
                return $this->userError('Do not provide an ID when using --all.');
            }

            if (! $this->confirmRevoke($global ? 'all global tokens' : 'all tokens for this tenant')) {
                return 1;
            }

            $user->tokens()->delete();

            return 0;
        }

        if ($tokenId === null || ! ctype_digit((string) $tokenId)) {
            return $this->userError('A numeric token ID is required unless --all is used.');
        }

        $token = $user->tokens()->whereKey((int) $tokenId)->first();
        if ($token === null) {
            return $this->userError($global ? 'The requested token ID does not exist for the global principal.' : 'The requested token ID does not exist for this tenant.');
        }

        if (! $this->confirmRevoke('token ' . $tokenId)) {
            return 1;
        }

        $user->tokens()->whereKey((int) $tokenId)->delete();

        return 0;
    }

    private function tenant(): ?Tenant
    {
        $identifier = (string) ($this->option('tenant') ?: '');
        if ($identifier === '') {
            if ((bool) $this->option('global')) {
                return null;
            }

            $this->errorOutput('The --tenant option is required.');

            return null;
        }

        $tenant = Tenant::query()->where('slug', $identifier)->first();
        if ($tenant === null && ctype_digit($identifier)) {
            $tenant = Tenant::query()->find((int) $identifier);
        }

        if ($tenant === null) {
            $this->errorOutput('The requested tenant does not exist.');
        }

        return $tenant;
    }

    /** @return list<string>|null */
    private function abilities(): ?array
    {
        $raw = $this->option('abilities');
        if ($raw === null || trim((string) $raw) === '') {
            return RscServicePrincipal::DEFAULT_ABILITIES;
        }

        $abilities = array_values(array_filter(array_map('trim', explode(',', (string) $raw))));
        $unknown = array_diff($abilities, RscServicePrincipal::DEFAULT_ABILITIES);
        if ($abilities === [] || $unknown !== []) {
            $this->errorOutput('Abilities must be a non-empty subset of the default RSC read abilities.');

            return null;
        }

        return array_values(array_unique($abilities));
    }

    private function confirmRevoke(string $target): bool
    {
        if ((bool) $this->option('force')) {
            return true;
        }

        return $this->confirm('Revoke ' . $target . '?');
    }

    private function userError(string $message): int
    {
        $this->errorOutput($message);

        return 1;
    }

    private function errorOutput(string $message): void
    {
        fwrite(STDERR, $message . PHP_EOL);
    }

    private function operator(): string
    {
        return (string) (getenv('CI_JOB_ID') ?: getenv('USER') ?: getenv('USERNAME') ?: 'unknown');
    }
}
