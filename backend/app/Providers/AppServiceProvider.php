<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Support\Tenancy\TenantManager;
use App\Contracts\DispatchesOrders;
use App\Policies\DispatchPolicy;
use App\Models\Dispatch;
use Illuminate\Support\Facades\Gate;
use App\Actions\Dispatches\DispatchOrdersAction;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Binds the TenantManager as a request-scoped singleton
        $this->app->singleton(TenantManager::class, TenantManager::class);

        // Inversion of Control interface mapping
        $this->app->bind(DispatchesOrders::class, DispatchOrdersAction::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('manage-team', function ($user): bool {
            $role = $user?->role;

            if ($role instanceof \BackedEnum) {
                $role = $role->value;
            }

            $normalizedRole = is_string($role) ? strtolower(trim($role)) : null;

            return $normalizedRole === 'super_admin';
        });

        Gate::define('manage-operations', function ($user): bool {
            $role = $user?->role;

            if ($role instanceof \BackedEnum) {
                $role = $role->value;
            }

            $normalizedRole = is_string($role) ? strtolower(trim($role)) : null;

            return in_array($normalizedRole, ['super_admin', 'dispatcher'], true);
        });

        Gate::define('manage-inventory', function ($user): bool {
            $role = $user?->role;

            if ($role instanceof \BackedEnum) {
                $role = $role->value;
            }

            $normalizedRole = is_string($role) ? strtolower(trim($role)) : null;

            return in_array($normalizedRole, ['super_admin', 'dispatcher', 'warehouse_manager'], true);
        });

        Gate::policy(Dispatch::class, DispatchPolicy::class);
    }
}
