<?php

declare(strict_types=1);

namespace App\DataTransferObjects\Logistics;

use App\Enums\Logistics\CarrierShipmentStatus;
use DateTimeImmutable;
use InvalidArgumentException;
use RuntimeException;

/**
 * A single tracking/status update for a carrier waybill.
 *
 * Deliberately shared by both integration directions:
 *  - LogisticsGatewayInterface::pullTrackingStatus() returns one when we
 *    actively poll a carrier.
 *  - CarrierWebhookController builds one (via fromArray()) from an
 *    already-validated inbound webhook payload.
 * Either way, downstream code (updating Dispatch/Stop state, broadcasting
 * DispatchMovementUpdated) consumes the same shape regardless of whether
 * the update was pushed or pulled.
 */
final readonly class CarrierTrackingUpdate
{
    public function __construct(
        public string $carrierWaybillReference,
        public CarrierShipmentStatus $status,
        public DateTimeImmutable $statusTimestamp,
        public ?string $carrierName = null,
        public ?string $locationDescription = null,
        public ?float $latitude = null,
        public ?float $longitude = null,
        public ?string $rawCarrierStatusCode = null,
    ) {
        if (trim($this->carrierWaybillReference) === '') {
            throw new InvalidArgumentException('carrierWaybillReference must not be empty.');
        }

        if (($this->latitude === null) !== ($this->longitude === null)) {
            throw new InvalidArgumentException('latitude and longitude must be provided together, or not at all.');
        }
    }

    /**
     * Builds an instance from already-validated associative array data —
     * e.g. the payload of an inbound carrier webhook, after it has passed
     * through a validator. Does not perform structural validation itself;
     * that is the caller's responsibility.
     *
     * @param array{
     *     carrier_waybill_reference: string,
     *     status: string,
     *     status_timestamp: string,
     *     carrier_name?: string|null,
     *     location_description?: string|null,
     *     latitude?: float|null,
     *     longitude?: float|null,
     *     raw_carrier_status_code?: string|null,
     * } $data
     *
     * @throws RuntimeException When `status` isn't a recognized CarrierShipmentStatus value.
     */
    public static function fromArray(array $data): self
    {
        $status = CarrierShipmentStatus::tryFrom($data['status']);

        if ($status === null) {
            throw new RuntimeException(sprintf('Unrecognized carrier status "%s".', $data['status']));
        }

        return new self(
            carrierWaybillReference: $data['carrier_waybill_reference'],
            status: $status,
            statusTimestamp: new DateTimeImmutable($data['status_timestamp']),
            carrierName: $data['carrier_name'] ?? null,
            locationDescription: $data['location_description'] ?? null,
            latitude: $data['latitude'] ?? null,
            longitude: $data['longitude'] ?? null,
            rawCarrierStatusCode: $data['raw_carrier_status_code'] ?? null,
        );
    }

    /**
     * @return array{carrier_waybill_reference: string, status: string, status_timestamp: string, carrier_name: string|null, location_description: string|null, latitude: float|null, longitude: float|null, raw_carrier_status_code: string|null}
     */
    public function toArray(): array
    {
        return [
            'carrier_waybill_reference' => $this->carrierWaybillReference,
            'status' => $this->status->value,
            'status_timestamp' => $this->statusTimestamp->format(DateTimeImmutable::ATOM),
            'carrier_name' => $this->carrierName,
            'location_description' => $this->locationDescription,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'raw_carrier_status_code' => $this->rawCarrierStatusCode,
        ];
    }
}
