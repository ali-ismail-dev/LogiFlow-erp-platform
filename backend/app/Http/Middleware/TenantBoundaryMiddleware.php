<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\Tenancy\TenantManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class TenantBoundaryMiddleware
{
    public function __construct(
        private readonly TenantManager $tenantManager,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $tenant = $this->tenantManager->getTenant();
        if ($tenant === null) {
            return $next($request);
        }

        $user = $request->user();
        if ($user === null) {
            return $next($request);
        }

        if ($user->isRscService()) {
            // The RSC service principal is a trusted backend-for-frontend identity
            // and is authorized to specify the tenant via X-Tenant-ID.
            return $next($request);
        }

        if ((int) $user->tenant_id !== (int) $tenant->id) {
            if ($request->bearerToken() !== null) {
                abort(401, 'Unauthorized.');
            }

            abort(403, 'Unauthorized tenant access.');
        }

        return $next($request);
    }
}
