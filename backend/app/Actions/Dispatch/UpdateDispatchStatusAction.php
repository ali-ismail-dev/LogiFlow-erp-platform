<?php

declare(strict_types=1);

namespace App\Actions\Dispatch;

use App\Enums\OrderStatus;
use App\Enums\StopStatus;
use App\Events\DispatchMovementUpdated;
use App\Models\Dispatch;
use App\Models\Order;
use Illuminate\Support\Facades\DB;

final class UpdateDispatchStatusAction
{
    public function __invoke(array $validated, string|int $tenantId, string|int $id): Dispatch
    {
        return DB::transaction(function () use ($validated, $tenantId, $id): Dispatch {
            $dispatch = Dispatch::query()
                ->where('tenant_id', $tenantId)
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();

            $dispatch->status = $validated['status'];

            if ($validated['status'] === 'in_transit') {
                $dispatch->departed_at = now();
            }

            if ($validated['status'] === 'completed') {
                $dispatch->stops()->update(['status' => StopStatus::Completed->value]);

                Order::query()
                    ->where('tenant_id', $tenantId)
                    ->where('dispatch_id', $dispatch->id)
                    ->update(['status' => OrderStatus::Delivered->value]);

                $dispatch->completed_at = now();
            }

            $dispatch->save();
            $dispatch->load(['warehouse', 'stops', 'orders']);
            DB::afterCommit(function () use ($dispatch): void {
                DispatchMovementUpdated::dispatch($dispatch);
            });

            return $dispatch->fresh();
        });
    }
}
