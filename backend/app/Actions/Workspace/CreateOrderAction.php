<?php

declare(strict_types=1);

namespace App\Actions\Workspace;

use App\Models\Order;

final class CreateOrderAction
{
    public function __invoke(array $validated, string|int $tenantId): Order
    {
        return Order::query()->create([
            'tenant_id' => $tenantId,
            'warehouse_id' => $validated['warehouse_id'],
            'order_number' => $validated['order_number'],
            'customer_name' => $validated['customer_name'],
            'total_weight_kg' => $validated['total_weight_kg'],
            'shipping_address' => $validated['shipping_address'],
            'status' => $validated['status'],
            'promised_at' => now()->addDays(2),
        ]);
    }
}
