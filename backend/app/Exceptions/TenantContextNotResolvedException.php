<?php

declare(strict_types=1);

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class TenantContextNotResolvedException extends DomainException
{
    public static function forModel(string $modelClass): self
    {
        return new self(
            "Attempted to query or create [{$modelClass}] without a resolved tenant context. " .
                "If this is intentional system-level code, call {$modelClass}::withoutTenancy() explicitly.",
        );
    }

    public static function forRoute(string $route): self
    {
        return new self("Tenant context could not be resolved for route [{$route}].");
    }

    /**
     * Render the exception as a clean HTTP 404 Not Found response.
     *
     * Without this handler, the generic RuntimeException (DomainException) is
     * dispatched as an HTTP 500 internal server error. Tenant-context failures
     * are client-correctable (missing/invalid header), so they must surface as
     * a normal 404 rather than a crash.
     */
    public function render(Request $request): JsonResponse
    {
        return new JsonResponse(
            [
                'message' => $this->getMessage(),
            ],
            Response::HTTP_NOT_FOUND,
            ['Content-Type' => 'application/json'],
        );
    }
}
