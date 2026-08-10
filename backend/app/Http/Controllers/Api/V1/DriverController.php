<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\DriverStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\DriverResource;
use App\Models\Driver;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class DriverController extends Controller
{
    /**
     * Display a listing of all drivers mapped to the current tenant workspace.
     *
     * Because the Driver model utilizes the BelongsToTenant trait, the global
     * TenantScope query firewall automatically appends a 'where tenant_id =
     * current' clause behind the scenes, preventing cross-tenant leakage.
     */
    public function index(): AnonymousResourceCollection
    {
        $drivers = Driver::query()
            // Alphabetical ordering by the underlying user's display name
            ->with('user')
            ->join('users', 'users.id', '=', 'drivers.user_id')
            ->orderBy('users.name', 'asc')
            ->select('drivers.*')
            ->get();

        return DriverResource::collection($drivers);
    }

    /**
     * Provision a new driver profile under the current tenant perimeter.
     */
    public function store(Request $request): DriverResource
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'license_number' => ['required', 'string', 'max:50'],
            'phone_number' => ['required', 'string', 'max:30'],
            'status' => ['sometimes', Rule::enum(DriverStatus::class)],
        ]);

        // Resolve the true, database-backed numeric Tenant model row from the
        // manager to extract its real integer ID.
        $tenantManager = app(TenantManager::class);
        $resolvedTenant = $tenantManager->getTenant();

        if (! $resolvedTenant) {
            throw new NotFoundHttpException(
                'Unable to securely resolve an active, mapped organizational workspace context.'
            );
        }

        $driver = Driver::create([
            'tenant_id' => $resolvedTenant->id,
            'user_id' => $validated['user_id'],
            'license_number' => $validated['license_number'],
            'phone_number' => $validated['phone_number'],
            'status' => $validated['status'] ?? DriverStatus::Active->value,
        ]);

        return new DriverResource($driver->load('user'));
    }
}
