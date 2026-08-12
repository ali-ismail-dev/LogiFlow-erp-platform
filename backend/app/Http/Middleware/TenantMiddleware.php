<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\TenantContextNotResolvedException;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class TenantMiddleware
{
    public function __construct(
        private readonly TenantManager $tenantManager,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Senior Performance Bypass — short-circuit health telemetry early
        if ($request->is('up') || $request->path() === 'up') {
            return $next($request);
        }

        $slug = $this->extractSlug($request);

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

        // FIXED: Reverted to standard clean query abstraction layer. Because Tenant is the parent 
        // entity, it carries no multi-tenant scopes, making Tenant::query() completely safe.
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

    private function extractSlug(Request $request): ?string
    {
        // --------------------------------------------------------------
        // PRIORITY 1 — Custom X-Tenant-ID header (explicit tenant pinning)
        // Used by internal Docker network services (e.g. Next.js RSC)
        // whose Host header reads "webserver" (no subdomain to extract).
        // --------------------------------------------------------------
        $tenantIdHeader = $request->header('X-Tenant-ID');
        if ($tenantIdHeader !== null && $tenantIdHeader !== '') {
            return strtolower(trim((string) $tenantIdHeader));
        }

        // --------------------------------------------------------------
        // PRIORITY 2 — Host-based subdomain extraction (standard browser
        // traffic: tenant.localhost:3000 or ://logiflow.com)
        // --------------------------------------------------------------
        $host = $request->header('host')
            ?? $request->server->get('HTTP_HOST')
            ?? $request->getHost();

        if ($host === null || $host === '') {
            return null;
        }

        $host = strtolower(trim((string) $host));
        $host = preg_replace('/:\d+$/', '', $host) ?? $host;

        // Defensive Check: Explicitly reject bare root hosts before index checks
        if ($host === 'localhost' || $host === 'logiflow.com' || $host === 'logiflow.app') {
            return null;
        }

        $segments = explode('.', $host);

        if (count($segments) < 2) {
            return null;
        }

        // Handle standard subdomains: tenant.localhost or tenant.logiflow.app
        $slug = trim($segments[0]);

        // Guard against core system aliases dropping into data maps
        if ($slug === 'www' || $slug === 'api' || $slug === 'admin' || $slug === 'app') {
            return null;
        }

        return $slug !== '' ? $slug : null;
    }
}
