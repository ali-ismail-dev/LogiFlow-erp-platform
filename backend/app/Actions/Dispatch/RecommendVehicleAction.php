<?php

declare(strict_types=1);

namespace App\Actions\Dispatch;

use App\Enums\DispatchStatus;
use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;

final class RecommendVehicleAction
{
    public function execute(
        int $tenantId,
        array $orderIds,
        ?string $preferredVehicleType = null,
        ?string $scheduledAt = null,
        int $windowMinutes = 60,
    ): array {
        $totalWeightKg = (float) Order::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('id', $orderIds)
            ->sum('total_weight_kg');

        $availableVehicles = Vehicle::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->when($preferredVehicleType !== null, fn($query) => $query->where('name', 'like', '%' . $preferredVehicleType . '%'))
            ->get()
            ->filter(fn(Vehicle $vehicle): bool => (float) $vehicle->max_weight_capacity_kg >= $totalWeightKg)
            ->reject(fn(Vehicle $vehicle): bool => $this->hasCollision($tenantId, (string) $vehicle->license_plate, $scheduledAt, $windowMinutes))
            ->map(function (Vehicle $vehicle) use ($totalWeightKg): array {
                $capacityKg = (float) $vehicle->max_weight_capacity_kg;
                $utilization = $capacityKg > 0 ? ($totalWeightKg / $capacityKg) * 100 : 0;

                return [
                    'vehicle_identifier' => $vehicle->license_plate,
                    'vehicle_name' => $vehicle->name,
                    'max_weight_capacity_kg' => $capacityKg,
                    'utilization_percentage' => round($utilization, 2),
                    'is_best_match' => false,
                ];
            })
            ->sortByDesc(fn(array $vehicle): float => $this->efficiencyScore($vehicle['utilization_percentage']))
            ->values();

        $recommendations = $availableVehicles->take(3)->values()->map(function (array $vehicle, int $index): array {
            $vehicle['is_best_match'] = $index === 0;
            return $vehicle;
        })->values();

        return [
            'total_weight_kg' => $totalWeightKg,
            'recommendations' => $recommendations->all(),
        ];
    }

    private function efficiencyScore(float $utilization): float
    {
        return 100 - abs($utilization - 90);
    }

    private function hasCollision(int $tenantId, string $vehicleIdentifier, ?string $scheduledAt, int $windowMinutes): bool
    {
        $dispatches = Dispatch::query()
            ->where('tenant_id', $tenantId)
            ->where('vehicle_identifier', $vehicleIdentifier)
            ->whereIn('status', [DispatchStatus::Planned->value, DispatchStatus::InTransit->value])
            ->get(['scheduled_at']);

        if ($scheduledAt === null) {
            return $dispatches->isNotEmpty();
        }

        $start = CarbonImmutable::parse($scheduledAt);
        $end = $start->addMinutes($windowMinutes);

        return $dispatches->contains(function (Dispatch $dispatch) use ($start, $end, $windowMinutes): bool {
            if ($dispatch->scheduled_at === null) {
                return true;
            }

            $existingStart = CarbonImmutable::instance($dispatch->scheduled_at);
            $existingEnd = $existingStart->addMinutes($windowMinutes);

            return $existingStart < $end && $existingEnd > $start;
        });
    }
}
