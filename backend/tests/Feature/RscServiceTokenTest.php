<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use App\Services\RscServicePrincipal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class RscServiceTokenTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function the_command_issues_a_token_with_the_default_abilities(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);

        $exitCode = Artisan::call('logiflow:rsc-token', [
            'action' => 'issue',
            '--tenant' => 'acme',
            '--name' => 'rsc-test',
        ]);

        $this->assertSame(0, $exitCode);
        $token = trim(Artisan::output());
        $accessToken = PersonalAccessToken::findToken($token);

        $this->assertNotEmpty($token);
        $this->assertNotNull($accessToken);
        $this->assertSame('rsc-test', $accessToken->name);
        $this->assertSame(
            RscServicePrincipal::DEFAULT_ABILITIES,
            $accessToken->abilities,
        );
        $this->assertSame($tenant->id, $accessToken->tokenable_id);
    }

    #[Test]
    public function issuing_twice_is_idempotent_for_the_service_user(): void
    {
        Tenant::factory()->create(['slug' => 'acme']);

        Artisan::call('logiflow:rsc-token', ['action' => 'issue', '--tenant' => 'acme']);
        Artisan::call('logiflow:rsc-token', ['action' => 'issue', '--tenant' => 'acme']);

        $this->assertSame(
            1,
            User::query()->where('email', RscServicePrincipal::EMAIL)->count(),
        );
    }

    #[Test]
    public function the_service_principal_cannot_use_interactive_login(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $principal = app(RscServicePrincipal::class)->ensureForTenant($tenant);
        $principal->forceFill(['password' => Hash::make('known-only-to-test')])->saveQuietly();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => RscServicePrincipal::EMAIL,
            'password' => 'known-only-to-test',
        ], [
            'X-Tenant-ID' => 'acme',
        ]);

        // The response is intentionally indistinguishable from a wrong password
        // so that the login endpoint does not reveal the RSC principal exists.
        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
        $this->assertGuest('web');
    }

    #[Test]
    public function a_revoked_rsc_token_is_rejected_by_a_protected_endpoint(): void
    {
        Tenant::factory()->create(['slug' => 'acme']);

        Artisan::call('logiflow:rsc-token', [
            'action' => 'issue',
            '--tenant' => 'acme',
        ]);
        $plainTextToken = trim(Artisan::output());
        $accessToken = PersonalAccessToken::findToken($plainTextToken);

        $this->withToken($plainTextToken)
            ->getJson('/api/v1/tenants/current', ['X-Tenant-ID' => 'acme'])
            ->assertOk();

        Artisan::call('logiflow:rsc-token', [
            'action' => 'revoke',
            'id' => (string) $accessToken->id,
            '--tenant' => 'acme',
            '--force' => true,
        ]);
        $this->app['auth']->forgetGuards();

        $this->withToken($plainTextToken)
            ->getJson('/api/v1/tenants/current', ['X-Tenant-ID' => 'acme'])
            ->assertUnauthorized();
    }

    #[Test]
    public function insufficient_ability_enforcement_remains_a_follow_up(): void
    {
        $this->markTestSkipped('TODO: enable endpoint-specific token ability middleware when read routes adopt tokenCan checks.');
    }
}
