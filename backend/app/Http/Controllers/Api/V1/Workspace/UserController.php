<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Workspace;

use App\Actions\Workspace\CreateUserAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\StoreUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

final class UserController extends Controller
{
    public function __construct(
        private readonly CreateUserAction $createUser,
    ) {}

    public function index(): AnonymousResourceCollection
    {
        $users = User::query()
            ->orderBy('name', 'asc')
            ->get();

        return UserResource::collection($users);
    }

    public function store(StoreUserRequest $request): UserResource
    {
        Gate::authorize('manage-team');

        $user = ($this->createUser)(
            $request->validated(),
            app(TenantManager::class)->id
        );

        return new UserResource($user);
    }
}