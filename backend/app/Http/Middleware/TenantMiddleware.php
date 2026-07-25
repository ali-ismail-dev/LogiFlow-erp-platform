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
        $slug = $this->extractSlug($request);

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

    private function extractSlug(Request $request): ?string
    {
        $host = $request->header('host')
            ?? $request->server->get('HTTP_HOST')
            ?? $request->getHost();

        if ($host === null || $host === '') {
            return null;
        }

        $host = strtolower(trim((string) $host));
        $host = preg_replace('/:\d+$/', '', $host) ?? $host;
        $segments = explode('.', $host);

        if (count($segments) < 2) {
            return null;
        }

        $slug = trim($segments[0]);

        return $slug !== '' ? $slug : null;
    }
}
