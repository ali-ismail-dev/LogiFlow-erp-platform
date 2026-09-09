<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Logistics;

use App\Actions\Logistics\CreateVehicleAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\StoreVehicleRequest;
use App\Http\Resources\VehicleResource;
use App\Models\Vehicle;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

final class VehicleController extends Controller
{
    public function __construct(
        private readonly CreateVehicleAction $createVehicle,
    ) {}

    public function index(): AnonymousResourceCollection
    {
        $vehicles = Vehicle::query()
            ->orderBy('name', 'asc')
            ->get();

        return VehicleResource::collection($vehicles);
    }

    public function store(StoreVehicleRequest $request): VehicleResource
    {
        Gate::authorize('manage-operations');

        $vehicle = ($this->createVehicle)(
            $request->validated(),
            app(TenantManager::class)->id
        );

        return new VehicleResource($vehicle);
    }
}
