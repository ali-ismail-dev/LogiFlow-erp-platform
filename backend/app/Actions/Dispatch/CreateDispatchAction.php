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
    public function __invoke(array $validated, string|int $tenantId): Dispatch
    {
        return DB::transaction(function () use ($validated, $tenantId): Dispatch {
            $driver = isset($validated['driver_id'])
                ? Driver::query()->whereKey($validated['driver_id'])->firstOrFail()
                : null;

            $vehicle = isset($validated['vehicle_id'])
                ? Vehicle::query()->whereKey($validated['vehicle_id'])->firstOrFail()
                : null;

            $dispatch = Dispatch::query()->create([
                'tenant_id' => $tenantId,
                'warehouse_id' => $driver->warehouse_id ?? $vehicle?->warehouse_id ?? null,
                'driver_name' => $driver?->user?->name ?? null,
                'vehicle_identifier' => $vehicle?->license_plate ?? null,
                'status' => 'planned',
                'reference_code' => 'DISP-' . now()->format('YmdHis') . '-' . random_int(1000, 9999),
                'scheduled_at' => now(),
            ]);

            $orderIds = array_values(array_unique($validated['order_ids']));
            $orders = Order::query()
                ->whereIn('id', $orderIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $sequence = 1;

            foreach ($orderIds as $orderId) {
                $order = $orders->get($orderId);

                if ($order === null) {
                    throw new NotFoundHttpException("Order #{$orderId} was not found in the active tenant scope.");
                }

                $order->update([
                    'status' => OrderStatus::Dispatched->value,
                    'dispatch_id' => $dispatch->id,
                ]);

                Stop::create([
                    'tenant_id' => $tenantId,
                    'dispatch_id' => $dispatch->id,
                    'order_id' => $order->id,
                    'sequence' => $sequence,
                    'destination_address' => $order->shipping_address ?? [
                        'street' => null,
                        'city' => null,
                        'state' => null,
                        'postal_code' => null,
                        'country' => null,
                    ],
                    'status' => StopStatus::Pending->value,
                ]);

                $sequence++;
            }

            return $dispatch->fresh();
        });
    }
}
