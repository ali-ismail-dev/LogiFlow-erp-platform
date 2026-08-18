<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Enum;

final class UserController extends Controller
{
    /**
     * Display a listing of all employees mapped to the current tenant workspace.
     * 
     * Because the User model utilizes the BelongsToTenant trait, the global query
     * scope automatically appends a 'where tenant_id = current' clause behind the 
     * scenes, preventing any cross-tenant data leakage.
     */
    public function index(): AnonymousResourceCollection
    {
        $users = User::query()
            ->orderBy('name', 'asc')
            ->get();

        return UserResource::collection($users);
    }

    /**
     * Provision a new team member under the current tenant perimeter.
     */
    public function store(Request $request): UserResource
    {
        Gate::authorize('manage-team');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', new \Illuminate\Validation\Rules\Enum(\App\Enums\UserRole::class)],
        ]);

        // Resolve the true, database-backed numeric Tenant model row from the manager 
        // to extract its real integer ID rather than attempting to write a text string slug.
        $tenantManager = app(\App\Support\Tenancy\TenantManager::class);
        $resolvedTenant = $tenantManager->getTenant();

        if (!$resolvedTenant) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException(
                "Unable to securely resolve an active, mapped organizational workspace context."
            );
        }

        $user = User::create([
            'tenant_id' => $resolvedTenant->id, // Real Numeric BIGINT Primary Key ID
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => $validated['role'],
            'password' => \Illuminate\Support\Facades\Hash::make('Welcome@LogiFlow2026'),
        ]);

        return new UserResource($user);
    }
}
