<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Support\Tenancy\TenantManager;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Binds the TenantManager as a request-scoped singleton
        $this->app->singleton(TenantManager::class, TenantManager::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
