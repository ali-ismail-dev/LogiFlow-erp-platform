<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Dispatch\ListDispatchesAction;
use App\Enums\DispatchStatus;
use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ListDispatchesRequest;
use App\Http\Resources\DispatchResource;
use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Driver;
use App\Models\Vehicle;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class DispatchController extends Controller
{
    public function __construct(
        private readonly ListDispatchesAction $listDispatches,
    ) {}

    public function index(ListDispatchesRequest $request): AnonymousResourceCollection
    {
        // NOTE: This route is intentionally NOT auth-protected (see api.php).
        // The React Server Component (RSC) fetches /dispatches server-to-server
        // via the X-Tenant-ID header with no browser session cookie, so an
        // authenticated Gate check would fail and return an empty list on every
        // refresh. Tenant isolation is strictly enforced by the global
        // TenantScope, which fails closed via TenantContextNotResolvedException.
        $dispatches = ($this->listDispatches)($request->validated());

        return DispatchResource::collection($dispatches);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_ids' => ['required', 'array'],
            'order_ids.*' => ['integer', 'exists:orders,id'],
            'driver_id' => ['required', 'integer', 'exists:drivers,id'],
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'],
        ]);

        $tenantManager = app(TenantManager::class);
        $resolvedTenant = $tenantManager->getTenant();

        if (! $resolvedTenant) {
            throw new NotFoundHttpException(
                'Unable to securely resolve an active, mapped organizational workspace context.'
            );
        }

        $dispatch = DB::transaction(function () use ($validated, $resolvedTenant): Dispatch {
            $driver = Driver::query()
                ->whereKey($validated['driver_id'])
                ->firstOrFail();

            $vehicle = Vehicle::query()
                ->whereKey($validated['vehicle_id'])
                ->firstOrFail();

            $dispatch = Dispatch::query()->create([
                'tenant_id' => $resolvedTenant->id,
                'warehouse_id' => $driver->warehouse_id ?? $vehicle->warehouse_id ?? null,
                'driver_name' => $driver->user?->name,
                'vehicle_identifier' => $vehicle->license_plate,
                'status' => DispatchStatus::Planned->value,
                'reference_code' => 'DISP-' . now()->format('YmdHis') . '-' . random_int(1000, 9999),
            ]);

            $orderIds = array_values(array_unique($validated['order_ids']));

            $orders = Order::query()
                ->whereIn('id', $orderIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($orderIds as $orderId) {
                $order = $orders->get($orderId);

                if ($order === null) {
                    throw new NotFoundHttpException("Order #{$orderId} was not found in the active tenant scope.");
                }

                $order->update([
                    'status' => OrderStatus::Dispatched->value,
                    'dispatch_id' => $dispatch->id,
                ]);
            }

            return $dispatch->fresh();
        });

        return response()->json([
            'data' => new DispatchResource($dispatch->load('warehouse', 'stops')),
        ], 201);
    }
}
