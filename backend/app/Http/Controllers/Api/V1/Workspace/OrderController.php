<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Workspace;

use App\Actions\Workspace\CreateOrderAction;
use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\StoreOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class OrderController extends Controller
{
    public function __construct(
        private readonly CreateOrderAction $createOrder,
    ) {}

    /**
     * Return a list of dispatchable, unassigned orders for the active tenant.
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

    public function store(StoreOrderRequest $request): OrderResource
    {
        $order = ($this->createOrder)(
            $request->validated(),
            app(TenantManager::class)->id
        );

        return new OrderResource($order);
    }
}
