<?php

declare(strict_types=1);

namespace App\Actions\Dispatch;

use App\Events\DispatchMovementUpdated;
use App\Models\Dispatch;
use App\Models\Driver;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AssignFleetAction
{
    public function __invoke(array $validated, string|int $tenantId, string|int $id): Dispatch
    {
        return DB::transaction(function () use ($validated, $tenantId, $id): Dispatch {
            $dispatch = Dispatch::query()
                ->where('tenant_id', $tenantId)
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();

            $driver = Driver::query()->whereKey($validated['driver_id'])->firstOrFail();
            $vehicle = Vehicle::query()->whereKey($validated['vehicle_id'])->lockForUpdate()->firstOrFail();

            $vehicleIsAssigned = Dispatch::query()
                ->whereKeyNot($dispatch->id)
                ->where('vehicle_identifier', $vehicle->license_plate)
                ->whereIn('status', ['planned', 'in_transit'])
                ->exists();

            if ($vehicleIsAssigned) {
                throw ValidationException::withMessages([
                    'vehicle_id' => ['The selected vehicle is already assigned to an active dispatch.'],
                ]);
            }

            $dispatch->update([
                'driver_name' => $driver->user?->name,
                'vehicle_identifier' => $vehicle->license_plate,
                'warehouse_id' => $dispatch->warehouse_id ?? $driver->warehouse_id ?? $vehicle->warehouse_id ?? null,
            ]);

            $dispatch->load(['warehouse', 'stops', 'orders']);
            DB::afterCommit(function () use ($dispatch): void {
                DispatchMovementUpdated::dispatch($dispatch);
            });

            return $dispatch->fresh();
        });
    }
}
