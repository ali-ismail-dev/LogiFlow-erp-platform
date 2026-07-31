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
        Gate::policy(Dispatch::class, DispatchPolicy::class);
    }
}
