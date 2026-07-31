<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Dispatch;
use App\Models\User;

class DispatchPolicy
{
    /**
     * Global Before Hook: A Tenant SuperAdmin can automatically execute any operation.
     */
    public function before(User $user, string $ability): ?bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }
        return null; // Fall through to standard methods if not super admin
    }

    /**
     * Regulates whether a user can fetch the real-time dispatches list.
     */
    public function viewAny(User $user): bool
    {
        // Both dispatchers and warehouse managers can monitor the fleet status
        return $user->isDispatcher() || $user->isWarehouseManager();
    }

    /**
     * Regulates whether a user can submit the Create Dispatch Manifest Form.
     */
    public function create(User $user): bool
    {
        // Strict Boundary: Only explicit dispatchers can initialize routes
        return $user->isDispatcher();
    }
}
