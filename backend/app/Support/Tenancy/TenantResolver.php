<?php

declare(strict_types=1);

namespace App\Support\Tenancy;

use Illuminate\Http\Request;

final class TenantResolver
{
    /**
     * Parse the inbound HTTP request attributes to extract the corporate slug.
     */
    public function resolveSlug(Request $request): ?string
    {
        $tenantIdHeader = $request->header('X-Tenant-ID');
        if ($tenantIdHeader !== null && $tenantIdHeader !== '') {
            return strtolower(trim((string) $tenantIdHeader));
        }

        $host = $request->header('host')
            ?? $request->server->get('HTTP_HOST')
            ?? $request->getHost();

        if ($host === null || $host === '') {
            return null;
        }

        $host = strtolower(trim((string) $host));
        $host = preg_replace('/:\d+$/', '', $host) ?? $host;

        if ($host === 'localhost' || $host === 'logiflow.com' || $host === 'logiflow.app') {
            return null;
        }

        $segments = explode('.', $host);
        if (count($segments) < 2) {
            return null;
        }

        $slug = trim($segments[0]);

        if ($slug === 'www' || $slug === 'api' || $slug === 'admin' || $slug === 'app') {
            return null;
        }

        return $slug !== '' ? $slug : null;
    }
}
