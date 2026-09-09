<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Workspace;

use App\Http\Controllers\Controller;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;

final class TenantController extends Controller
{
    public function __construct(
        private readonly TenantManager $tenantManager,
    ) {}

    /**
     * Resolve the currently-scoped tenant to its canonical numeric id.
     */
    public function current(): JsonResponse
    {
        if (! $this->tenantManager->check()) {
            return response()->json(['message' => 'No tenant context resolved.'], 404);
        }

        $tenant = $this->tenantManager->getTenant();

        return response()->json([
            'data' => [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
                'name' => $tenant->name,
            ],
        ], 200);
    }
}
