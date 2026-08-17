<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class WarehouseController extends Controller
{
    public function index(): JsonResponse
    {
        // Global TenantScope automatically firewalls these rows to the active tenant
        $warehouses = Warehouse::query()->orderBy('name', 'asc')->get();

        return response()->json([
            'data' => $warehouses,
        ], 200);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50'],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:100'],
        ]);

        $tenantManager = app(TenantManager::class);
        $resolvedTenant = $tenantManager->getTenant();

        if (! $resolvedTenant) {
            throw new NotFoundHttpException('Unable to securely resolve an active tenant context.');
        }

        $warehouse = Warehouse::query()->create([
            'tenant_id' => $resolvedTenant->id,
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'address' => [
                'street' => $validated['address'],
                'city' => $validated['city'],
                'state' => null,
                'zip_code' => null,
            ],
            'is_active' => true,
        ]);

        return response()->json([
            'data' => $warehouse,
        ], 201);
    }
}
