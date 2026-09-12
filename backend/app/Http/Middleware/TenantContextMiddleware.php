<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\TenantContextNotResolvedException;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use App\Support\Tenancy\TenantResolver;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class TenantContextMiddleware
{
    public function __construct(
        private readonly TenantManager $tenantManager,
        private readonly TenantResolver $tenantResolver,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('up') || $request->path() === 'up') {
            return $next($request);
        }

        $slug = $this->tenantResolver->resolveSlug($request);

        if ($this->tenantManager->check()) {
            if ($slug === null) {
                if ($request->route() === null) {
                    $tenant = $this->tenantManager->getTenant();
                } else {
                    $this->tenantManager->forget();
                }
            } else {
                $currentTenant = $this->tenantManager->getTenant();
                if ($currentTenant?->slug === $slug) {
                    $tenant = $currentTenant;
                } else {
                    $this->tenantManager->forget();
                }
            }

            if ($this->tenantManager->check()) {
                return $next($request);
            }
        }

        if ($slug === null) {
            throw TenantContextNotResolvedException::forRoute($request->path());
        }

        /** @var Tenant|null $tenant */
        $tenant = Tenant::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if ($tenant === null) {
            throw TenantContextNotResolvedException::forRoute($request->path());
        }

        $this->tenantManager->resolve($tenant);

        return $next($request);
    }
}
