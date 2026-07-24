<?php

declare(strict_types=1);

namespace App\DataTransferObjects\Logistics;

use InvalidArgumentException;

/**
 * A single stop within an outbound CarrierManifestRequest.
 *
 * Deliberately framework-agnostic — no Eloquent model, no Stop/Order
 * reference, just the plain data a carrier needs to complete a delivery.
 * Building this from a domain Stop/Order pair is an application-layer
 * concern, not this DTO's.
 */
final readonly class CarrierManifestStopRequest
{
    public function __construct(
        public int $sequence,
        public string $recipientName,
        public string $addressLine1,
        public ?string $addressLine2,
        public string $city,
        public string $postalCode,
        public string $countryCode,
        public string $phoneNumber,
        public float $parcelWeightKg,
    ) {
        if ($this->sequence < 1) {
            throw new InvalidArgumentException('Stop sequence must be 1 or greater.');
        }

        if ($this->parcelWeightKg <= 0.0) {
            throw new InvalidArgumentException('Parcel weight must be greater than zero.');
        }

        if (strlen($this->countryCode) !== 2) {
            throw new InvalidArgumentException('Country code must be a 2-letter ISO 3166-1 alpha-2 code.');
        }

        $requiredStrings = [
            'recipientName' => $this->recipientName,
            'addressLine1' => $this->addressLine1,
            'city' => $this->city,
            'postalCode' => $this->postalCode,
            'phoneNumber' => $this->phoneNumber,
        ];

        foreach ($requiredStrings as $field => $value) {
            if (trim($value) === '') {
                throw new InvalidArgumentException(sprintf('%s must not be empty.', $field));
            }
        }
    }

    /**
     * @return array{sequence: int, recipient_name: string, address_line_1: string, address_line_2: string|null, city: string, postal_code: string, country_code: string, phone_number: string, parcel_weight_kg: float}
     */
    public function toArray(): array
    {
        return [
            'sequence' => $this->sequence,
            'recipient_name' => $this->recipientName,
            'address_line_1' => $this->addressLine1,
            'address_line_2' => $this->addressLine2,
            'city' => $this->city,
            'postal_code' => $this->postalCode,
            'country_code' => $this->countryCode,
            'phone_number' => $this->phoneNumber,
            'parcel_weight_kg' => $this->parcelWeightKg,
        ];
    }
}
