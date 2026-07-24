<?php

declare(strict_types=1);

namespace App\Enums\Logistics;

/**
 * Canonical shipment status vocabulary used across the platform, regardless
 * of which carrier or integration path (pulled or pushed via webhook)
 * produced the update. Carrier-specific raw codes are preserved separately
 * (see CarrierTrackingUpdate::$rawCarrierStatusCode) rather than being
 * added as extra cases here.
 */
enum CarrierShipmentStatus: string
{
    case PickedUp = 'picked_up';
    case InTransit = 'in_transit';
    case OutForDelivery = 'out_for_delivery';
    case Delivered = 'delivered';
    case DeliveryFailed = 'delivery_failed';
    case Unknown = 'unknown';

    /**
     * True once the shipment has reached an end state and no further
     * tracking updates should be expected.
     */
    public function isTerminal(): bool
    {
        return match ($this) {
            self::Delivered, self::DeliveryFailed => true,
            self::PickedUp, self::InTransit, self::OutForDelivery, self::Unknown => false,
        };
    }
}
