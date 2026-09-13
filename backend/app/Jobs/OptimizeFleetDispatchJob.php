<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\OrderStatus;
use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Stop;
use App\Models\Tenant;
use App\Models\Vehicle;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Bus\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use RuntimeException;

final class OptimizeFleetDispatchJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $uniqueFor = 3600;

    /**
     * @param array<int, int> $orderIds
     */
    public function __construct(
        private readonly array $orderIds,
        private readonly string|int $tenantId,
    ) {
        if ($this->orderIds === []) {
            throw new InvalidArgumentException('OptimizeFleetDispatchJob requires at least one order ID.');
        }
    }

    public function uniqueId(): string
    {
        $normalized = $this->orderIds;
        sort($normalized, SORT_NUMERIC);
        return 'fleet-dispatch:' . $this->tenantId . ':' . implode('-', $normalized);
    }

    /**
     * @throws RuntimeException
     * @throws ValidationException
     */
    public function handle(): Dispatch
    {
        // Force-inject context state into memory to activate database TenantScope filters inside background queues.
        $tenant = Tenant::findOrFail($this->tenantId);
        app(\App\Support\Tenancy\TenantManager::class)->resolve($tenant);

        return DB::transaction(function (): Dispatch {
            $orders = $this->resolveOrders();

            // Harmonized field accessor pointing to total_weight_kg matching Phase 2 tables
            $totalWeightKg = (float) $orders->sum(
                static fn(Order $order): float => (float) $order->total_weight_kg
            );

            $vehicle = $this->selectVehicleForPayload($totalWeightKg);

            $dispatch = Dispatch::create([
                // Maps our exact Phase 2 table identifiers
                'warehouse_id' => $orders->first()->warehouse_id,
                'reference_code' => 'DSP-' . strtoupper(uniqid()),
                'vehicle_identifier' => $vehicle->license_plate,
                'driver_name' => 'Unassigned',
                'status' => \App\Enums\DispatchStatus::Planned->value,
                'scheduled_at' => now()->addHours(2),
            ]);

            $this->assignSequencedStops($dispatch, $orders);

            Order::query()
                ->whereIn('id', $orders->pluck('id')->all())
                ->update([
                    'status' => OrderStatus::Dispatched->value,
                    'dispatch_id' => $dispatch->id,
                    'updated_at' => now(),
                ]);

            return $dispatch->load([
                'stops' => static fn(HasMany $query): HasMany => $query->orderBy('sequence')->with('order'),
            ]);
        });
    }

    private function resolveOrders(): Collection
    {
        $orders = Order::query()
            ->whereIn('id', $this->orderIds)
            ->whereNull('dispatch_id')
            ->whereIn('status', [OrderStatus::Pending->value, OrderStatus::Processing->value])
            ->lockForUpdate()
            ->get();

        if ($orders->count() !== count($this->orderIds)) {
            $missingIds = array_values(array_diff($this->orderIds, $orders->pluck('id')->all()));
            throw new RuntimeException(sprintf(
                'Refusing to dispatch orders [%s]: one or more are already dispatched or not in a dispatchable state.',
                implode(', ', $missingIds),
            ));
        }

        if ($orders->pluck('tenant_id')->unique()->count() > 1) {
            throw new RuntimeException('Refusing to bundle orders across multi-tenant boundaries.');
        }

        return $orders;
    }

    private function selectVehicleForPayload(float $totalWeightKg): Vehicle
    {
        $vehicleIds = Vehicle::query()
            ->where('is_active', true)
            // Harmonized with our exact migrated table column name parameter
            ->where('max_weight_capacity_kg', '>=', $totalWeightKg)
            ->orderBy('max_weight_capacity_kg')
            ->pluck('id');

        foreach ($vehicleIds as $vehicleId) {
            $vehicle = Vehicle::query()->lockForUpdate()->find($vehicleId);

            if ($vehicle === null || $this->vehicleHasActiveDispatch($vehicle)) {
                continue;
            }

            return $vehicle;
        }

        throw ValidationException::withMessages([
            'order_ids' => [sprintf(
                'No active fleet vehicle can carry the combined batch payload of %.2fkg.',
                $totalWeightKg
            )],
        ]);
    }

    private function vehicleHasActiveDispatch(Vehicle $vehicle): bool
    {
        return Dispatch::query()
            ->where('vehicle_identifier', $vehicle->license_plate)
            ->whereIn('status', [
                \App\Enums\DispatchStatus::Planned->value,
                \App\Enums\DispatchStatus::InTransit->value,
            ])
            ->exists();
    }

    private function assignSequencedStops(Dispatch $dispatch, Collection $orders): void
    {
        $sorted = $orders
            ->sortBy(static fn(Order $order) => $order->delivery_window_start)
            ->values();

        $stops = [];
        $now = now();

        foreach ($sorted as $order) {
            $stops[] = [
                'tenant_id' => $this->tenantId,
                'dispatch_id' => $dispatch->id,
                'order_id' => $order->id,
                'sequence' => count($stops) + 1,
                'destination_address' => is_array($order->shipping_address)
                    ? json_encode($order->shipping_address, JSON_THROW_ON_ERROR)
                    : $order->shipping_address,
                'status' => \App\Enums\StopStatus::Pending->value,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        Stop::query()->insert($stops);
    }
}
