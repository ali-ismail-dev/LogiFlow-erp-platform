<?php

declare(strict_types=1);

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ResourceUnavailableException extends DomainException
{
    public function __construct(
        public readonly string $resource,
        public readonly string $resourceName,
        public readonly string $dispatchCode,
        public readonly string $dispatchStatus,
    ) {
        $label = ucfirst($resource);
        parent::__construct(sprintf(
            '%s %s is already assigned to active dispatch %s (%s).',
            $label,
            $resourceName,
            $dispatchCode,
            $dispatchStatus,
        ));
    }

    public function render(Request $request): JsonResponse
    {
        $field = $this->resource === 'driver' ? 'driver_name' : 'vehicle_identifier';
        $message = $this->resource === 'driver'
            ? 'Driver is already assigned to an active dispatch.'
            : 'Vehicle is already assigned to an active dispatch.';

        return response()->json([
            'message' => $this->getMessage(),
            'errors' => [
                $field => [$message],
            ],
        ], 422);
    }
}
