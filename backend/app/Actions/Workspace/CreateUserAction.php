<?php

declare(strict_types=1);

namespace App\Actions\Workspace;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

final class CreateUserAction
{
    public function __invoke(array $validated, string|int $tenantId): User
    {
        return User::create([
            'tenant_id' => $tenantId,
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => $validated['role'],
            'password' => Hash::make('Welcome@LogiFlow2026'),
        ]);
    }
}