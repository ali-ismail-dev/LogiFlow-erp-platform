<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Dispatch\ListDispatchesAction;
use App\Enums\OrderStatus;
use App\Enums\StopStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ListDispatchesRequest;
use App\Http\Resources\DispatchResource;
use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Driver;
use App\Models\Stop;
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
            'driver_id' => ['nullable', 'integer', 'exists:drivers,id'],
            'vehicle_id' => ['nullable', 'integer', 'exists:vehicles,id'],
        ]);

        $tenantManager = app(TenantManager::class);
        $resolvedTenant = $tenantManager->getTenant();

        if (! $resolvedTenant) {
            throw new NotFoundHttpException(
                'Unable to securely resolve an active, mapped organizational workspace context.'
            );
        }

        $dispatch = DB::transaction(function () use ($validated, $resolvedTenant): Dispatch {
            $driver = isset($validated['driver_id'])
                ? Driver::query()->whereKey($validated['driver_id'])->firstOrFail()
                : null;

            $vehicle = isset($validated['vehicle_id'])
                ? Vehicle::query()->whereKey($validated['vehicle_id'])->firstOrFail()
                : null;

            $dispatch = Dispatch::query()->create([
                'tenant_id' => $resolvedTenant->id,
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
                    'tenant_id' => $resolvedTenant->id,
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

        return response()->json([
            'data' => new DispatchResource($dispatch->load('warehouse', 'stops')),
        ], 201);
    }

    public function assignFleet(Request $request, string|int $id): JsonResponse
    {
        $validated = $request->validate([
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

        $dispatch = DB::transaction(function () use ($validated, $resolvedTenant, $id): Dispatch {
            $dispatch = Dispatch::query()
                ->where('tenant_id', $resolvedTenant->id)
                ->where('id', $id)
                ->firstOrFail();

            $driver = Driver::query()
                ->whereKey($validated['driver_id'])
                ->firstOrFail();

            $vehicle = Vehicle::query()
                ->whereKey($validated['vehicle_id'])
                ->firstOrFail();

            $dispatch->update([
                'driver_name' => $driver->user?->name,
                'vehicle_identifier' => $vehicle->license_plate,
                'warehouse_id' => $dispatch->warehouse_id ?? $driver->warehouse_id ?? $vehicle->warehouse_id ?? null,
            ]);

            $dispatch->load(['warehouse', 'stops', 'orders']);
            event(new \App\Events\DispatchMovementUpdated($dispatch));

            return $dispatch->fresh();
        });

        return response()->json([
            'data' => new DispatchResource($dispatch),
        ], 200);
    }

    public function updateStatus(Request $request, string|int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:planned,in_transit,arrived,completed'],
        ]);

        $tenantManager = app(TenantManager::class);
        $resolvedTenant = $tenantManager->getTenant();

        if (! $resolvedTenant) {
            throw new NotFoundHttpException(
                'Unable to securely resolve an active, mapped organizational workspace context.'
            );
        }

        $dispatch = DB::transaction(function () use ($validated, $resolvedTenant, $id): Dispatch {
            $dispatch = Dispatch::query()
                ->where('tenant_id', $resolvedTenant->id)
                ->where('id', $id)
                ->firstOrFail();

            $dispatch->status = $validated['status'];

            // AUTOMATION FIX: Lock in a real timestamp when the driver clicks 'Start Run'
            // so that management cockpits and mobile viewports display live departure times.
            if ($validated['status'] === 'in_transit') {
                $dispatch->departed_at = now();
            }

            // CASCADING TRANSITION FIX: Automatically advance child rows upon manifest completion
            if ($validated['status'] === 'completed') {
                // Advance all child stops bound to this manifest to completed.
                $dispatch->stops()->update(['status' => StopStatus::Completed->value]);

                // Use a direct tenant-scoped query for the child orders to avoid
                // relation resolution issues in stale or partially cached runtime states.
                Order::query()
                    ->where('tenant_id', $resolvedTenant->id)
                    ->where('dispatch_id', $dispatch->id)
                    ->update(['status' => OrderStatus::Delivered->value]);

                $dispatch->completed_at = now();
            }

            $dispatch->save();

            // REAL-TIME SYNCHRONIZATION FIX: Hydrate child structures before broadcasting
            // so the admin dashboard UI grid can update counters reactively with zero refresh lags.
            $dispatch->load(['warehouse', 'stops', 'orders']);

            event(new \App\Events\DispatchMovementUpdated($dispatch));

            return $dispatch->fresh();
        });

        return response()->json([
            'data' => new DispatchResource($dispatch),
        ], 200);
    }
}
