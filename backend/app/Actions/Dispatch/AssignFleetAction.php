<?php

declare(strict_types=1);

namespace App\Actions\Dispatch;

use App\Events\DispatchMovementUpdated;
use App\Models\Dispatch;
use App\Models\Driver;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;

final class AssignFleetAction
{
    public function __invoke(array $validated, string|int $tenantId, string|int $id): Dispatch
    {
        return DB::transaction(function () use ($validated, $tenantId, $id): Dispatch {
            $dispatch = Dispatch::query()
                ->where('tenant_id', $tenantId)
                ->whereKey($id)
                ->firstOrFail();

            $driver = Driver::query()->whereKey($validated['driver_id'])->firstOrFail();
            $vehicle = Vehicle::query()->whereKey($validated['vehicle_id'])->firstOrFail();

            $dispatch->update([
                'driver_name' => $driver->user?->name,
                'vehicle_identifier' => $vehicle->license_plate,
                'warehouse_id' => $dispatch->warehouse_id ?? $driver->warehouse_id ?? $vehicle->warehouse_id ?? null,
            ]);

            $dispatch->load(['warehouse', 'stops', 'orders']);
            event(new DispatchMovementUpdated($dispatch));

            return $dispatch->fresh();
        });
    }
}
