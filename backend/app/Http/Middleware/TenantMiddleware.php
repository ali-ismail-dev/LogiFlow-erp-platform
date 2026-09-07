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

final class TenantMiddleware
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
                return $next($request);
            }

            $currentTenant = $this->tenantManager->getTenant();
            if ($currentTenant?->slug === $slug) {
                return $next($request);
            }

            $this->tenantManager->forget();
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
