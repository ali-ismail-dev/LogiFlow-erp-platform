<?php

declare(strict_types=1);

namespace App\Actions\Logistics;

use App\Enums\DriverStatus;
use App\Models\Driver;
use App\Models\User;
use App\Support\Tenancy\TenantManager;

final class CreateDriverAction
{
    public function __invoke(array $validated): Driver
    {
        $tenantId = app(TenantManager::class)->id;

        // Verify the user belongs to this tenant. Throws 404 if not.
        $user = User::query()
            ->where('id', $validated['user_id'])
            ->where('tenant_id', $tenantId)
            ->firstOrFail();

        return Driver::create([
            'user_id' => $validated['user_id'],
            'license_number' => $validated['license_number'],
            'phone_number' => $validated['phone_number'],
            'status' => $validated['status'] ?? DriverStatus::Active->value,
        ])->load('user');
    }
}
