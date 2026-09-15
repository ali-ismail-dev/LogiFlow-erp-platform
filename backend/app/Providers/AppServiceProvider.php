<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Contracts\DispatchesOrders;
use App\Policies\DispatchPolicy;
use App\Models\Dispatch;
use App\Models\User;
use App\Enums\UserRole;
use Illuminate\Support\Facades\Gate;
use App\Actions\Dispatch\DispatchOrdersAction;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Inversion of Control interface mapping
        $this->app->bind(DispatchesOrders::class, DispatchOrdersAction::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('manage-team', function (User $user): bool {
            return $user->role === UserRole::SuperAdmin;
        });

        Gate::define('manage-operations', function (User $user): bool {
            return in_array($user->role, [UserRole::SuperAdmin, UserRole::Dispatcher], true);
        });

        Gate::define('manage-inventory', function (User $user): bool {
            return in_array($user->role, [UserRole::SuperAdmin, UserRole::Dispatcher, UserRole::WarehouseManager], true);
        });

        \Laravel\Sanctum\Sanctum::usePersonalAccessTokenModel(\App\Models\PersonalAccessToken::class);

        Gate::policy(Dispatch::class, DispatchPolicy::class);
    }
}
