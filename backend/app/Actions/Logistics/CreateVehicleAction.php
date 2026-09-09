<?php

declare(strict_types=1);

namespace App\Actions\Logistics;

use App\Models\Vehicle;

final class CreateVehicleAction
{
    public function __invoke(array $validated, string|int $tenantId): Vehicle
    {
        return Vehicle::create([
            'tenant_id' => $tenantId,
            'name' => $validated['name'],
            'license_plate' => $validated['license_plate'],
            'max_weight_capacity_kg' => $validated['max_weight_capacity_kg'],
            'is_active' => $validated['is_active'] ?? true,
        ]);
    }
}