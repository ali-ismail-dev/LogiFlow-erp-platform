<?php

declare(strict_types=1);

namespace App\Actions\Workspace;

use App\Models\Warehouse;

final class CreateWarehouseAction
{
    public function __invoke(array $validated, string|int $tenantId): Warehouse
    {
        return Warehouse::query()->create([
            'tenant_id' => $tenantId,
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'address' => [
                'street' => $validated['address'],
                'city' => $validated['city'],
                'state' => null,
                'zip_code' => null,
            ],
            'is_active' => true,
        ]);
    }
}
