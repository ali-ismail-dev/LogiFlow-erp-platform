<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Logistics;

use App\Actions\Dispatch\AssignFleetAction;
use App\Actions\Dispatch\CreateDispatchAction;
use App\Actions\Dispatch\ListDispatchesAction;
use App\Actions\Dispatch\UpdateDispatchStatusAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ListDispatchesRequest;
use App\Http\Requests\Api\V1\Logistics\AssignFleetRequest;
use App\Http\Requests\Api\V1\Logistics\StoreDispatchRequest;
use App\Http\Requests\Api\V1\Logistics\UpdateDispatchStatusRequest;
use App\Http\Resources\DispatchResource;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class DispatchController extends Controller
{
    public function __construct(
        private readonly ListDispatchesAction $listDispatches,
        private readonly CreateDispatchAction $createDispatch,
        private readonly AssignFleetAction $assignFleet,
        private readonly UpdateDispatchStatusAction $updateDispatchStatus,
    ) {}

    public function index(ListDispatchesRequest $request): AnonymousResourceCollection
    {
        return DispatchResource::collection(($this->listDispatches)($request->validated()));
    }

    public function store(StoreDispatchRequest $request): JsonResponse
    {
        $dispatch = ($this->createDispatch)($request->validated(), app(TenantManager::class)->id);

        return response()->json([
            'data' => new DispatchResource($dispatch->load('warehouse', 'stops')),
        ], 201);
    }

    public function assignFleet(AssignFleetRequest $request, string|int $id): JsonResponse
    {
        $dispatch = ($this->assignFleet)($request->validated(), app(TenantManager::class)->id, $id);

        return response()->json(['data' => new DispatchResource($dispatch)], 200);
    }

    public function updateStatus(UpdateDispatchStatusRequest $request, string|int $id): JsonResponse
    {
        $dispatch = ($this->updateDispatchStatus)($request->validated(), app(TenantManager::class)->id, $id);

        return response()->json(['data' => new DispatchResource($dispatch)], 200);
    }
}