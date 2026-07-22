<?php

declare(strict_types=1);

namespace App\DataTransferObjects;

use DateTimeImmutable;

final readonly class DispatchOrdersData
{
    /**
     * @param  array<int, StopData>  $stops
     */
    public function __construct(
        public int $warehouseId,
        public string $referenceCode,
        public ?string $driverName,
        public ?string $vehicleIdentifier,
        public ?DateTimeImmutable $scheduledAt,
        public array $stops,
    ) {}

    public function stopCount(): int
    {
        return count($this->stops);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function fromArray(array $payload): self
    {
        return new self(
            warehouseId: (int) $payload['warehouse_id'],
            referenceCode: (string) $payload['reference_code'],
            driverName: $payload['driver_name'] ?? null,
            vehicleIdentifier: $payload['vehicle_identifier'] ?? null,
            scheduledAt: isset($payload['scheduled_at'])
                ? new DateTimeImmutable((string) $payload['scheduled_at'])
                : null,
            stops: array_map(
                static fn (array $stop): StopData => StopData::fromArray($stop),
                $payload['stops'],
            ),
        );
    }
}
