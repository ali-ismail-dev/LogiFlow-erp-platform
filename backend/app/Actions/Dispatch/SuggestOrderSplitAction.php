<?php

declare(strict_types=1);

namespace App\Actions\Dispatch;

use App\Models\Order;
use App\Models\Vehicle;

final class SuggestOrderSplitAction
{
    public function __construct(private readonly RecommendVehicleAction $recommendVehicle) {}

    public function execute(int $tenantId, array $orderIds, ?string $targetVehicleIdentifier = null): array
    {
        $orders = Order::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('id', $orderIds)
            ->get(['id', 'total_weight_kg'])
            ->sortByDesc('total_weight_kg')
            ->values();

        $totalWeightKg = (float) $orders->sum('total_weight_kg');
        $vehicles = Vehicle::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->when($targetVehicleIdentifier !== null, fn($query) => $query->where('license_plate', $targetVehicleIdentifier))
            ->orderByDesc('max_weight_capacity_kg')
            ->get();

        $maxCapacity = (float) ($vehicles->max('max_weight_capacity_kg') ?? 0);
        $batches = [];

        foreach ($orders as $order) {
            $weight = (float) $order->total_weight_kg;
            $batchIndex = collect($batches)->search(fn(array $batch): bool => $batch['batch_weight_kg'] + $weight <= $batch['capacity_kg']);

            if ($batchIndex === false) {
                $vehicle = $vehicles->first(fn(Vehicle $candidate): bool => (float) $candidate->max_weight_capacity_kg >= $weight);
                $batches[] = [
                    'order_ids' => [(int) $order->id],
                    'batch_weight_kg' => $weight,
                    'capacity_kg' => (float) ($vehicle?->max_weight_capacity_kg ?? 0),
                    'recommended_vehicle' => $vehicle?->license_plate,
                ];
                continue;
            }

            $batches[$batchIndex]['order_ids'][] = (int) $order->id;
            $batches[$batchIndex]['batch_weight_kg'] += $weight;
        }

        $batches = collect($batches)->values()->map(function (array $batch, int $index) use ($tenantId): array {
            if ($batch['recommended_vehicle'] === null) {
                $recommendation = $this->recommendVehicle->execute($tenantId, $batch['order_ids']);
                $batch['recommended_vehicle'] = $recommendation['recommendations'][0]['vehicle_identifier'] ?? null;
            }

            return [
                'batch_number' => $index + 1,
                'order_ids' => $batch['order_ids'],
                'batch_weight_kg' => $batch['batch_weight_kg'],
                'recommended_vehicle' => $batch['recommended_vehicle'],
            ];
        })->all();

        return [
            'can_fit_single_vehicle' => $maxCapacity >= $totalWeightKg && $vehicles->isNotEmpty(),
            'total_weight_kg' => $totalWeightKg,
            'suggested_batches' => $batches,
        ];
    }
}
