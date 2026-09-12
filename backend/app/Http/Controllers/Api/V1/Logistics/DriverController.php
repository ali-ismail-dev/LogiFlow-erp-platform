<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Logistics;

use App\Actions\Logistics\CreateDriverAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\StoreDriverRequest;
use App\Http\Resources\DriverResource;
use App\Models\Driver;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

final class DriverController extends Controller
{
    public function __construct(
        private readonly CreateDriverAction $createDriver,
    ) {}

    /**
     * Display a listing of all drivers mapped to the current tenant workspace.
     */
    public function index(): AnonymousResourceCollection
    {
        $drivers = Driver::query()
            ->with('user')
            ->join('users', 'users.id', '=', 'drivers.user_id')
            ->orderBy('users.name', 'asc')
            ->select('drivers.*')
            ->paginate(50)
            ->withQueryString();

        return DriverResource::collection($drivers);
    }

    /**
     * Provision a new driver profile under the current tenant perimeter.
     */
    public function store(StoreDriverRequest $request): DriverResource
    {
        Gate::authorize('manage-operations');

        $driver = ($this->createDriver)($request->validated());

        return new DriverResource($driver);
    }
}
