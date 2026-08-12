<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

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
}
