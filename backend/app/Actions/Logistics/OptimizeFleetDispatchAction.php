<?php

declare(strict_types=1);

namespace App\Actions\Logistics;

use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Stop;
use App\Models\Vehicle;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Bus\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use RuntimeException;

class OptimizeFleetDispatchAction implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $uniqueFor = 3600;

    /**
     * @param array<int, int> $orderIds
     */
    public function __construct(
        private readonly array $orderIds,
    ) {
        if ($this->orderIds === []) {
            throw new InvalidArgumentException('OptimizeFleetDispatchAction requires at least one order ID.');
        }
    }

    public function uniqueId(): string
    {
        $normalized = $this->orderIds;
        sort($normalized, SORT_NUMERIC);
        return 'fleet-dispatch:' . implode('-', $normalized);
    }

    /**
     * @throws ModelNotFoundException
     * @throws RuntimeException
     * @throws ValidationException
     */
    public function handle(): Dispatch
    {
        $orders = $this->resolveOrders();

        // Harmonized field accessor pointing to total_weight_kg matching Phase 2 tables
        $totalWeightKg = (float) $orders->sum(
            static fn(Order $order): float => (float) $order->total_weight_kg
        );

        return DB::transaction(function () use ($orders, $totalWeightKg): Dispatch {
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

            return $dispatch->load([
                'stops' => static fn(HasMany $query): HasMany => $query->orderBy('sequence')->with('order'),
            ]);
        });
    }

    private function resolveOrders(): Collection
    {
        $orders = Order::query()->whereIn('id', $this->orderIds)->get();

        if ($orders->count() !== count($this->orderIds)) {
            $missingIds = array_values(array_diff($this->orderIds, $orders->pluck('id')->all()));
            throw (new ModelNotFoundException())->setModel(Order::class, $missingIds);
        }

        if ($orders->pluck('tenant_id')->unique()->count() > 1) {
            throw new RuntimeException('Refusing to bundle orders across multi-tenant boundaries.');
        }

        return $orders;
    }

    private function selectVehicleForPayload(float $totalWeightKg): Vehicle
    {
        $vehicle = Vehicle::query()
            ->where('is_active', true)
            // Harmonized with our exact migrated table column name parameter
            ->where('max_weight_capacity_kg', '>=', $totalWeightKg)
            ->orderBy('max_weight_capacity_kg')
            ->lockForUpdate()
            ->first();

        if ($vehicle === null) {
            throw ValidationException::withMessages([
                'order_ids' => [sprintf(
                    'No active fleet vehicle can carry the combined batch payload of %.2fkg.',
                    $totalWeightKg
                )],
            ]);
        }

        return $vehicle;
    }

    private function assignSequencedStops(Dispatch $dispatch, Collection $orders): void
    {
        $sorted = $orders
            ->sortBy(static fn(Order $order) => $order->delivery_window_start)
            ->values();

        $sequence = 1;

        foreach ($sorted as $order) {
            Stop::create([
                'dispatch_id' => $dispatch->id,
                'order_id' => $order->id,
                'sequence' => $sequence,
                'destination_address' => $order->shipping_address,
                'status' => \App\Enums\StopStatus::Pending->value,
            ]);

            $sequence++;
        }
    }
}
