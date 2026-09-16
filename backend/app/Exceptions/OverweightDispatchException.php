<?php

declare(strict_types=1);

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OverweightDispatchException extends DomainException
{
    public function __construct(
        public readonly string $vehicleIdentifier,
        public readonly string|int|float $weightKg,
        public readonly string|int|float $capacityKg,
    ) {
        parent::__construct(sprintf(
            'Cannot assign vehicle %s. This dispatch weighs %s kg, but the vehicle capacity is %s kg.',
            $vehicleIdentifier,
            number_format((float) $weightKg, 0, '.', ','),
            number_format((float) $capacityKg, 0, '.', ','),
        ));
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'errors' => [
                'vehicle_identifier' => ['Vehicle payload capacity exceeded.'],
            ],
        ], 422);
    }
}
