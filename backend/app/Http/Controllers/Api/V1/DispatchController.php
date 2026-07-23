<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Dispatch\ListDispatchesAction; // ASSUMPTION — see note below
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ListDispatchesRequest;
use App\Http\Resources\DispatchResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * NOTE ON THE ASSUMED DEPENDENCY: `ListDispatchesAction` stands in for
 * "the underlying Action/Repository class from Phase 2." This repo's
 * actual class/namespace almost certainly differs — swap the import and
 * the constructor type-hint for whatever Phase 2 really exposes. Nothing
 * else in this controller should need to change: the shape (validate,
 * delegate, return a Resource) is the contract, not the class name.
 *
 * Tenant scoping is NOT applied here. It is assumed Phase 2's action/
 * repository (or a global model scope beneath it) already scopes every
 * query to the tenant resolved by the `tenant` route middleware — a
 * fail-closed design means this controller should be structurally
 * *unable* to fetch another tenant's rows, not merely trusted not to.
 */
final class DispatchController extends Controller
{
    public function __construct(
        private readonly ListDispatchesAction $listDispatches,
    ) {}

    public function index(ListDispatchesRequest $request): AnonymousResourceCollection
    {
        $dispatches = ($this->listDispatches)($request->filters());

        return DispatchResource::collection($dispatches);
    }
}
