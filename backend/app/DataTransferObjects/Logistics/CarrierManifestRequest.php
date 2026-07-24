<?php

declare(strict_types=1);

namespace App\DataTransferObjects\Logistics;

use DateTimeImmutable;
use InvalidArgumentException;

/**
 * Vendor-agnostic manifest submitted to LogisticsGatewayInterface::submitManifest().
 *
 * `dispatchReference` should be a stable, external-facing identifier (a
 * UUID/ULID or public dispatch code) — never the raw Dispatch database
 * primary key. Building this DTO from a Dispatch + its Stops is an
 * application-layer responsibility; this class has no knowledge of
 * Eloquent or the database.
 */
final readonly class CarrierManifestRequest
{
    /**
     * @param non-empty-string $dispatchReference
     * @param array<int, CarrierManifestStopRequest> $stops
     */
    public function __construct(
        public string $dispatchReference,
        public array $stops,
        public float $totalWeightKg,
        public ?DateTimeImmutable $requestedPickupAt = null,
    ) {
        if (trim($this->dispatchReference) === '') {
            throw new InvalidArgumentException('dispatchReference must not be empty.');
        }

        if ($this->stops === []) {
            throw new InvalidArgumentException('A manifest requires at least one stop.');
        }

        if (! array_all($this->stops, static fn(mixed $stop): bool => $stop instanceof CarrierManifestStopRequest)) {
            throw new InvalidArgumentException('Every stop must be a CarrierManifestStopRequest instance.');
        }

        if ($this->totalWeightKg <= 0.0) {
            throw new InvalidArgumentException('totalWeightKg must be greater than zero.');
        }
    }

    /**
     * @return array{dispatch_reference: string, stops: array<int, array<string, mixed>>, total_weight_kg: float, requested_pickup_at: string|null}
     */
    public function toArray(): array
    {
        return [
            'dispatch_reference' => $this->dispatchReference,
            'stops' => array_map(
                static fn(CarrierManifestStopRequest $stop): array => $stop->toArray(),
                $this->stops,
            ),
            'total_weight_kg' => $this->totalWeightKg,
            'requested_pickup_at' => $this->requestedPickupAt?->format(DateTimeImmutable::ATOM),
        ];
    }
}
