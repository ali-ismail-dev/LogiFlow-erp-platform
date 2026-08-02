<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;

final class TenantController extends Controller
{
    public function __construct(
        private readonly TenantManager $tenantManager,
    ) {}

    /**
     * Resolve the currently-scoped tenant (from the X-Tenant-ID header or
     * subdomain) to its canonical numeric id.
     *
     * The frontend needs the numeric tenant id to build the private
     * broadcast channel name `tenant.{id}.ops` — the exact same value the
     * backend event uses when it calls PrivateChannel(). The dashboard
     * route slug is cosmetic and must never be used as the security-scoped
     * channel identity.
     */
    public function current(): JsonResponse
    {
        if (! $this->tenantManager->check()) {
            return response()->json(['message' => 'No tenant context resolved.'], 404);
        }

        $tenant = $this->tenantManager->tenant;

        return response()->json([
            'data' => [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
                'name' => $tenant->name,
            ],
        ]);
    }
}

