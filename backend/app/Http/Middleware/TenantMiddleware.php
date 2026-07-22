<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final readonly class TenantMiddleware
{
    /**
     * Reserved subdomains that should never be interpreted as tenant slugs.
     *
     * These may later be moved to config/tenancy.php.
     *
     * @var list<string>
     */
    private const RESERVED_SUBDOMAINS = [
        'www',
        'admin',
        'api',
        'app',
        'cdn',
        'assets',
        'static',
        'mail',
        'ftp',
    ];

    public function __construct(
        private TenantManager $tenantManager,
    ) {}

    /**
     * Resolve the active tenant from the request host.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $slug = $this->extractSubdomain($request);

        /*
         * No tenant subdomain was present.
         *
         * Example:
         *   localhost
         *   example.com
         *
         * The application is expected to be accessed through a tenant
         * subdomain, therefore we return a clean 404.
         */
        if ($slug === null) {
            abort(Response::HTTP_NOT_FOUND, 'Tenant not found.');
        }

        /*
         * Prevent reserved infrastructure subdomains from being treated
         * as tenants.
         */
        if ($this->isReservedSubdomain($slug)) {
            abort(Response::HTTP_NOT_FOUND, 'Tenant not found.');
        }

        /** @var Tenant|null $tenant */
        $tenant = Tenant::query()
            ->where('slug', $slug)
            ->first();

        if ($tenant === null) {
            abort(Response::HTTP_NOT_FOUND, 'Tenant not found.');
        }

        $this->tenantManager->setTenant($tenant);

        return $next($request);
    }

    /**
     * Extract the tenant slug from the request host.
     *
     * Examples:
     *
     * nike.localhost        => nike
     * nike.localhost:8000   => nike
     * nike.logiflow.test    => nike
     * acme.example.com      => acme
     * localhost             => null
     * example.com           => null
     */
    private function extractSubdomain(Request $request): ?string
    {
        /*
         * Request::getHost() never contains the port.
         *
         * Therefore:
         * nike.localhost:8000 -> nike.localhost
         */
        $host = strtolower($request->getHost());

        /*
         * Remove accidental trailing dots.
         */
        $host = rtrim($host, '.');

        $segments = explode('.', $host);

        /*
         * localhost
         * example.com
         *
         * Both contain fewer than three segments and therefore have
         * no tenant subdomain.
         *
         * localhost          => 1 segment
         * example.com        => 2 segments
         * nike.localhost     => 2 segments (special-cased below)
         */
        if ($host === 'localhost') {
            return null;
        }

        /*
         * Support local development:
         *
         * nike.localhost
         */
        if (
            count($segments) === 2 &&
            $segments[1] === 'localhost'
        ) {
            return $segments[0];
        }

        /*
         * Production:
         *
         * tenant.example.com
         * tenant.logiflow.io
         */
        if (count($segments) >= 3) {
            return $segments[0];
        }

        return null;
    }

    /**
     * Determine whether the supplied slug is reserved.
     */
    private function isReservedSubdomain(string $slug): bool
    {
        return in_array(
            strtolower($slug),
            self::RESERVED_SUBDOMAINS,
            true,
        );
    }
}
