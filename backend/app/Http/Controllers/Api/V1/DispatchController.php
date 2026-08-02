<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Dispatch\ListDispatchesAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ListDispatchesRequest;
use App\Http\Resources\DispatchResource;
use App\Models\Dispatch;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

final class DispatchController extends Controller
{
    public function __construct(
        private readonly ListDispatchesAction $listDispatches,
    ) {}

    public function index(ListDispatchesRequest $request): AnonymousResourceCollection
    {
        // FIXED: Enforce strict role-based authorization checkpoint before processing records
        Gate::authorize('viewAny', Dispatch::class);

        // FIXED: Safely process validated request parameters down the query line
        $dispatches = ($this->listDispatches)($request->validated());

        return DispatchResource::collection($dispatches);
    }
}
