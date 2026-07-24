<?php

declare(strict_types=1);

namespace App\DataTransferObjects\Logistics;

use DateTimeImmutable;
use InvalidArgumentException;

/**
 * Result of LogisticsGatewayInterface::submitManifest().
 *
 * `carrierWaybillReference` is the value that should be persisted onto the
 * Dispatch record so an inbound carrier webhook can later be matched back
 * to it (see CarrierWebhookController).
 */
final readonly class CarrierManifestResult
{
    public function __construct(
        public string $carrierWaybillReference,
        public string $carrierName,
        public bool $accepted,
        public DateTimeImmutable $submittedAt,
        public ?string $rejectionReason = null,
    ) {
        if (trim($this->carrierWaybillReference) === '') {
            throw new InvalidArgumentException('carrierWaybillReference must not be empty.');
        }

        if (trim($this->carrierName) === '') {
            throw new InvalidArgumentException('carrierName must not be empty.');
        }

        if (! $this->accepted && $this->rejectionReason === null) {
            throw new InvalidArgumentException('A rejected manifest result must include a rejectionReason.');
        }
    }

    /**
     * @return array{carrier_waybill_reference: string, carrier_name: string, accepted: bool, submitted_at: string, rejection_reason: string|null}
     */
    public function toArray(): array
    {
        return [
            'carrier_waybill_reference' => $this->carrierWaybillReference,
            'carrier_name' => $this->carrierName,
            'accepted' => $this->accepted,
            'submitted_at' => $this->submittedAt->format(DateTimeImmutable::ATOM),
            'rejection_reason' => $this->rejectionReason,
        ];
    }
}
