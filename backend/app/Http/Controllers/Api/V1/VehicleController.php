<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\VehicleResource;
use App\Models\Vehicle;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class VehicleController extends Controller
{
    /**
     * Display a listing of all vehicles mapped to the current tenant workspace.
     *
     * Because the Vehicle model utilizes the BelongsToTenant trait, the global
     * TenantScope query firewall automatically appends a 'where tenant_id =
     * current' clause behind the scenes, preventing cross-tenant leakage.
     */
    public function index(): AnonymousResourceCollection
    {
        $vehicles = Vehicle::query()
            ->orderBy('name', 'asc')
            ->get();

        return VehicleResource::collection($vehicles);
    }

    /**
     * Register a new vehicle under the current tenant perimeter.
     */
    public function store(Request $request): VehicleResource
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'license_plate' => ['required', 'string', 'max:50', 'unique:vehicles,license_plate'],
            'max_weight_capacity_kg' => ['required', 'numeric'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        // Resolve the true, database-backed numeric Tenant model row from the
        // manager to extract its real integer ID for the mutation.
        $tenantManager = app(TenantManager::class);
        $resolvedTenant = $tenantManager->getTenant();

        if (! $resolvedTenant) {
            throw new NotFoundHttpException(
                'Unable to securely resolve an active, mapped organizational workspace context.'
            );
        }

        $vehicle = Vehicle::create([
            'tenant_id' => $resolvedTenant->id,
            'name' => $validated['name'],
            'license_plate' => $validated['license_plate'],
            'max_weight_capacity_kg' => $validated['max_weight_capacity_kg'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return new VehicleResource($vehicle);
    }
}
