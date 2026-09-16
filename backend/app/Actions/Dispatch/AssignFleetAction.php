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
    public function __construct(
        private readonly ValidateDispatchFeasibilityAction $validateDispatchFeasibility,
    ) {}

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

            $this->validateDispatchFeasibility->execute(
                (int) $tenantId,
                $dispatch->orders()->pluck('orders.id')->all(),
                $vehicle->license_plate,
                $driver->user?->name,
                (int) $dispatch->id,
            );

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
