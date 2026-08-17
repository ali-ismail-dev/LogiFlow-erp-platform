<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class OrderController extends Controller
{
    /**
     * Return a list of dispatchable, unassigned orders for the active tenant.
     * This route is intentionally not auth-protected so the Next.js RSC can
     * fetch inventory server-to-server using the X-Tenant-ID header.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = Order::query()
            ->whereIn('status', [OrderStatus::Pending->value, OrderStatus::Processing->value])
            ->whereNull('dispatch_id')
            ->orderBy('promised_at', 'asc')
            ->get();

        return OrderResource::collection($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'order_number' => ['required', 'string', 'max:255'],
            'customer_name' => ['required', 'string', 'max:255'],
            'total_weight_kg' => ['required', 'numeric', 'gt:0'],
            'shipping_address' => ['required', 'array'],
            'shipping_address.street' => ['required', 'string', 'max:255'],
            'shipping_address.city' => ['required', 'string', 'max:100'],
            'status' => ['required', 'string', 'in:pending'],
        ]);

        $tenantManager = app(TenantManager::class);
        $resolvedTenant = $tenantManager->getTenant();

        if (! $resolvedTenant) {
            throw new NotFoundHttpException('Unable to securely resolve an active tenant context.');
        }

        $order = Order::query()->create([
            'tenant_id' => $resolvedTenant->id,
            'warehouse_id' => $validated['warehouse_id'],
            'order_number' => $validated['order_number'],
            'customer_name' => $validated['customer_name'],
            'total_weight_kg' => $validated['total_weight_kg'],
            'shipping_address' => $validated['shipping_address'],
            'status' => $validated['status'],
            'promised_at' => now()->addDays(2),
        ]);

        return response()->json([
            'data' => $order,
        ], 201);
    }
}
