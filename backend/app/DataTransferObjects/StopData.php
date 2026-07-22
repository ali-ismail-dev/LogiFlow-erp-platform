<?php

declare(strict_types=1);

namespace App\DataTransferObjects;

final readonly class StopData
{
    /**
     * @param  array<string, mixed>  $destinationAddress
     */
    public function __construct(
        public int $orderId,
        public int $sequence,
        public array $destinationAddress,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function fromArray(array $payload): self
    {
        return new self(
            orderId: (int) $payload['order_id'],
            sequence: (int) $payload['sequence'],
            destinationAddress: $payload['destination_address'],
        );
    }
}
