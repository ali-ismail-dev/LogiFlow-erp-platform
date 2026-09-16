<?php

declare(strict_types=1);

namespace App\Actions\Dispatch;

use App\Enums\DispatchStatus;
use App\Exceptions\OverweightDispatchException;
use App\Exceptions\ResourceUnavailableException;
use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;

final class ValidateDispatchFeasibilityAction
{
    public function execute(
        int $tenantId,
        array $orderIds,
        ?string $vehicleIdentifier = null,
        ?string $driverName = null,
        ?int $ignoreDispatchId = null,
    ): void {
        DB::transaction(function () use ($tenantId, $orderIds, $vehicleIdentifier, $driverName, $ignoreDispatchId): void {
            $totalWeightKg = Order::query()
                ->where('tenant_id', $tenantId)
                ->whereIn('id', $orderIds)
                ->lockForUpdate()
                ->get()
                ->sum('total_weight_kg');

            if ($vehicleIdentifier !== null) {
                $vehicle = Vehicle::query()
                    ->where('tenant_id', $tenantId)
                    ->where('license_plate', $vehicleIdentifier)
                    ->lockForUpdate()
                    ->first();

                if ($vehicle !== null && $totalWeightKg > $vehicle->max_weight_capacity_kg) {
                    throw new OverweightDispatchException(
                        $vehicleIdentifier,
                        $totalWeightKg,
                        $vehicle->max_weight_capacity_kg,
                    );
                }

                $activeVehicleDispatch = Dispatch::query()
                    ->where('tenant_id', $tenantId)
                    ->where('vehicle_identifier', $vehicleIdentifier)
                    ->whereIn('status', [DispatchStatus::Planned->value, DispatchStatus::InTransit->value])
                    ->when($ignoreDispatchId !== null, fn($query) => $query->where('id', '!=', $ignoreDispatchId))
                    ->lockForUpdate()
                    ->first();

                if ($activeVehicleDispatch !== null) {
                    throw new ResourceUnavailableException(
                        'vehicle',
                        $vehicleIdentifier,
                        (string) $activeVehicleDispatch->reference_code,
                        (string) $activeVehicleDispatch->status->value,
                    );
                }
            }

            if ($driverName !== null) {
                $activeDriverDispatch = Dispatch::query()
                    ->where('tenant_id', $tenantId)
                    ->where('driver_name', $driverName)
                    ->whereIn('status', [DispatchStatus::Planned->value, DispatchStatus::InTransit->value])
                    ->when($ignoreDispatchId !== null, fn($query) => $query->where('id', '!=', $ignoreDispatchId))
                    ->lockForUpdate()
                    ->first();

                if ($activeDriverDispatch !== null) {
                    throw new ResourceUnavailableException(
                        'driver',
                        $driverName,
                        (string) $activeDriverDispatch->reference_code,
                        (string) $activeDriverDispatch->status->value,
                    );
                }
            }
        });
    }
}
