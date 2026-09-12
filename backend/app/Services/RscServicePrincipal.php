<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\UserRole;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use LogicException;

final class RscServicePrincipal
{
    public const EMAIL = 'rsc-service@internal.logiflow.invalid';

    /** @var list<string> */
    public const DEFAULT_ABILITIES = [
        'rsc:orders:read',
        'rsc:drivers:read',
        'rsc:warehouses:read',
        'rsc:vehicles:read',
        'rsc:dispatches:read',
        'rsc:users:read',
        'rsc:tenant:read',
    ];

    public function __construct(
        private readonly TenantManager $tenantManager,
    ) {}

    public function findForTenant(Tenant $tenant): ?User
    {
        $this->tenantManager->resolve($tenant);

        return User::query()
            ->where('email', self::EMAIL)
            ->first();
    }

    public function ensureForTenant(Tenant $tenant): User
    {
        $this->tenantManager->resolve($tenant);

        $user = User::query()
            ->where('email', self::EMAIL)
            ->first();

        if ($user !== null) {
            if (! $user->isRscService()) {
                throw new LogicException('The reserved RSC service email belongs to another role.');
            }

            return $user;
        }

        try {
            $user = User::create([
                'tenant_id' => $tenant->id,
                'role' => UserRole::RscService,
                'name' => 'RSC Service Principal',
                'email' => self::EMAIL,
                'password' => Hash::make(Str::random(128)),
            ]);
        } catch (\Illuminate\Database\UniqueConstraintViolationException) {
            return User::query()->where('email', self::EMAIL)->firstOrFail();
        }

        $user->forceFill([
            'email_verified_at' => now(),
        ])->saveQuietly();

        return $user;
    }
}
