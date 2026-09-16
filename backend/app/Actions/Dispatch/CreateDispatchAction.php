<?php

declare(strict_types=1);

namespace App\Actions\Dispatch;

use App\Enums\OrderStatus;
use App\Enums\StopStatus;
use App\Models\Dispatch;
use App\Models\Driver;
use App\Models\Order;
use App\Models\Stop;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class CreateDispatchAction
{
    public function __construct(
        private readonly ValidateDispatchFeasibilityAction $validateDispatchFeasibility,
    ) {}

    public function __invoke(array $validated, string|int $tenantId): Dispatch
    {
        return DB::transaction(function () use ($validated, $tenantId): Dispatch {
            $driver = isset($validated['driver_id'])
                ? Driver::query()->whereKey($validated['driver_id'])->firstOrFail()
                : null;

            $vehicle = isset($validated['vehicle_id'])
                ? Vehicle::query()->whereKey($validated['vehicle_id'])->lockForUpdate()->firstOrFail()
                : null;

            $orderIds = array_values(array_unique($validated['order_ids']));

            $this->validateDispatchFeasibility->execute(
                (int) $tenantId,
                $orderIds,
                $vehicle?->license_plate,
                $driver?->user?->name,
            );

            $dispatch = Dispatch::query()->create([
                'tenant_id' => $tenantId,
                'warehouse_id' => $driver->warehouse_id ?? $vehicle?->warehouse_id ?? null,
                'driver_name' => $driver?->user?->name ?? null,
                'vehicle_identifier' => $vehicle?->license_plate ?? null,
                'status' => 'planned',
                'reference_code' => 'DISP-' . now()->format('YmdHis') . '-' . random_int(1000, 9999),
                'scheduled_at' => now(),
            ]);

            $orders = Order::query()
                ->whereIn('id', $orderIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $stops = [];
            $now = now();
            $sequence = 1;

            foreach ($orderIds as $orderId) {
                $order = $orders->get($orderId);

                if ($order === null) {
                    throw new NotFoundHttpException("Order #{$orderId} was not found in the active tenant scope.");
                }

                $stops[] = [
                    'tenant_id' => $tenantId,
                    'dispatch_id' => $dispatch->id,
                    'order_id' => $order->id,
                    'sequence' => $sequence,
                    'destination_address' => json_encode($order->shipping_address ?? [
                        'street' => null,
                        'city' => null,
                        'state' => null,
                        'postal_code' => null,
                        'country' => null,
                    ], JSON_THROW_ON_ERROR),
                    'status' => StopStatus::Pending->value,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $sequence++;
            }

            Order::query()
                ->whereIn('id', $orderIds)
                ->update([
                    'status' => OrderStatus::Dispatched->value,
                    'dispatch_id' => $dispatch->id,
                    'updated_at' => $now,
                ]);

            Stop::query()->insert($stops);

            return $dispatch->fresh();
        });
    }
}
