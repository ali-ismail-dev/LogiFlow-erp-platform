<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['tenant_id', 'role', 'name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, BelongsToTenant;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class, // Enforces type-safe backing enum hydration
        ];
    }

    /** Strict Role Evaluation Primitive Guard Helpers */
    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SuperAdmin;
    }

    public function isWarehouseManager(): bool
    {
        return $this->role === UserRole::WarehouseManager;
    }

    public function isDispatcher(): bool
    {
        return $this->role === UserRole::Dispatcher;
    }
    // FIXED: Appended the missing primitive helper to cover the read-only driver boundary taxonomy
    public function isDriver(): bool
    {
        return $this->role === UserRole::Driver;
    }
}
