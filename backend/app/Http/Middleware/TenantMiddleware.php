<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class TenantMiddleware
{
    public function __construct(
        private readonly TenantManager $tenantManager,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $slug = $this->extractSlug($request);

        if ($slug === null) {
            throw new NotFoundHttpException('Unable to resolve a tenant subdomain from this request.');
        }

        /** @var Tenant|null $tenant */
        $tenant = Tenant::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if ($tenant === null) {
            throw new NotFoundHttpException("No active tenant matches [{$slug}].");
        }

        $this->tenantManager->resolve($tenant);

        return $next($request);
    }

    private function extractSlug(Request $request): ?string
    {
        $host = $request->getHost();
        $segments = explode('.', $host);

        if (count($segments) < 2) {
            return null;
        }

        // FIX: Extract the first segment element string explicitly before converting case
        $slug = strtolower($segments[0]);

        return $slug !== '' ? $slug : null;
    }
}
