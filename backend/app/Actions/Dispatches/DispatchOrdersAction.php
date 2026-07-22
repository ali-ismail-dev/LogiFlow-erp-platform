<?php

declare(strict_types=1);

namespace App\Actions\Dispatches;

use App\Contracts\DispatchesOrders;
use App\DataTransferObjects\DispatchOrdersData;
use App\Enums\DispatchStatus;
use App\Enums\OrderStatus;
use App\Enums\StopStatus;
use App\Exceptions\OrderNotDispatchableException;
use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class DispatchOrdersAction implements DispatchesOrders
{
    public function __invoke(DispatchOrdersData $data): Dispatch
    {
        if ($data->stops === []) {
            throw new InvalidArgumentException('A dispatch requires at least one stop.');
        }

        return DB::transaction(function () use ($data): Dispatch {
            $warehouse = Warehouse::query()->findOrFail($data->warehouseId);

            $dispatch = $warehouse->dispatches()->create([
                'reference_code' => $data->referenceCode,
                'driver_name' => $data->driverName,
                'vehicle_identifier' => $data->vehicleIdentifier,
                'status' => DispatchStatus::Planned,
                'scheduled_at' => $data->scheduledAt,
            ]);

            $orders = Order::query()
                ->whereKey(array_map(static fn ($stop) => $stop->orderId, $data->stops))
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($data->stops as $stopData) {
                $order = $orders->get($stopData->orderId);

                if ($order === null) {
                    throw OrderNotDispatchableException::notFoundInTenant($stopData->orderId);
                }

                if (! $order->status->isDispatchable()) {
                    throw OrderNotDispatchableException::forOrder(
                        $order->order_number,
                        $order->status->value,
                    );
                }

                $dispatch->stops()->create([
                    'order_id' => $order->id,
                    'sequence' => $stopData->sequence,
                    'destination_address' => $stopData->destinationAddress,
                    'status' => StopStatus::Pending,
                ]);

                $order->update(['status' => OrderStatus::Dispatched]);
            }

            return $dispatch->load(['warehouse', 'stops.order']);
        });
    }
}
