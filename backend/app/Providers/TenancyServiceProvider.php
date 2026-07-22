<?php

declare(strict_types=1);

namespace App\Providers;

use App\Support\Tenancy\TenantManager;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\ServiceProvider;

final class TenancyServiceProvider extends ServiceProvider
{
    /**
     * Register application services.
     */
    public function register(): void
    {
        /*
         * Bind the TenantManager as a scoped service.
         *
         * Although a traditional PHP-FPM request would make a singleton
         * effectively request-scoped, Laravel's scoped() binding is the
         * correct choice for long-running workers (Octane, RoadRunner,
         * Swoole, Horizon, etc.), ensuring a fresh TenantManager instance
         * for every request/job lifecycle while remaining singleton-like
         * within that lifecycle.
         */
        $this->app->scoped(
            TenantManager::class,
            static fn(Application $app): TenantManager => new TenantManager(),
        );

        /*
         * Optional convenience alias.
         *
         * Allows dependency resolution using:
         *
         * app('tenant')
         * resolve('tenant')
         *
         * while still keeping the class itself as the canonical type.
         */
        $this->app->alias(
            TenantManager::class,
            'tenant',
        );
    }

    /**
     * Bootstrap application services.
     */
    public function boot(): void
    {
        //
        // Reserved for future tenancy bootstrapping.
        //
        // Examples:
        // - Database-per-tenant connection switching
        // - Cache prefix isolation
        // - Queue context propagation
        // - Filesystem disk prefixing
        // - Telescope / Pulse tagging
        // - Activity log tenant enrichment
        //
        // Phase 1 intentionally keeps this empty because TenantMiddleware
        // becomes responsible for populating the TenantManager after the
        // HTTP request has been identified.
        //
    }
}
