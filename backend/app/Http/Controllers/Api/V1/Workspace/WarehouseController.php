<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Workspace;

use App\Actions\Workspace\CreateWarehouseAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\StoreWarehouseRequest;
use App\Http\Resources\WarehouseResource;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

final class WarehouseController extends Controller
{
    public function __construct(
        private readonly CreateWarehouseAction $createWarehouse,
    ) {}

    public function index(): AnonymousResourceCollection
    {
        $warehouses = Warehouse::query()
            ->orderBy('name', 'asc')
            ->paginate(50)
            ->withQueryString();

        return WarehouseResource::collection($warehouses);
    }

    public function store(StoreWarehouseRequest $request): WarehouseResource
    {
        Gate::authorize('manage-inventory');

        $warehouse = ($this->createWarehouse)(
            $request->validated(),
            app(TenantManager::class)->id
        );

        return new WarehouseResource($warehouse);
    }
}
