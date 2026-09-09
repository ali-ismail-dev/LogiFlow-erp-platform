<?php

declare(strict_types=1);

namespace App\Actions\Logistics;

use App\Enums\DriverStatus;
use App\Models\Driver;

final class CreateDriverAction
{
    public function __invoke(array $validated, string|int $tenantId): Driver
    {
        return Driver::create([
            'tenant_id' => $tenantId,
            'user_id' => $validated['user_id'],
            'license_number' => $validated['license_number'],
            'phone_number' => $validated['phone_number'],
            'status' => $validated['status'] ?? DriverStatus::Active->value,
        ])->load('user');
    }
}
