<?php

declare(strict_types=1);

namespace Tests\Unit\Enums;

use App\Enums\Logistics\CarrierShipmentStatus;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class CarrierShipmentStatusTest extends TestCase
{
    #[Test]
    public function it_has_expected_cases(): void
    {
        $this->assertSame('picked_up', CarrierShipmentStatus::PickedUp->value);
        $this->assertSame('in_transit', CarrierShipmentStatus::InTransit->value);
        $this->assertSame('out_for_delivery', CarrierShipmentStatus::OutForDelivery->value);
        $this->assertSame('delivered', CarrierShipmentStatus::Delivered->value);
        $this->assertSame('delivery_failed', CarrierShipmentStatus::DeliveryFailed->value);
        $this->assertSame('unknown', CarrierShipmentStatus::Unknown->value);
    }

    #[Test]
    public function delivered_is_terminal(): void
    {
        $this->assertTrue(CarrierShipmentStatus::Delivered->isTerminal());
    }

    #[Test]
    public function delivery_failed_is_terminal(): void
    {
        $this->assertTrue(CarrierShipmentStatus::DeliveryFailed->isTerminal());
    }

    #[Test]
    public function picked_up_is_not_terminal(): void
    {
        $this->assertFalse(CarrierShipmentStatus::PickedUp->isTerminal());
    }

    #[Test]
    public function in_transit_is_not_terminal(): void
    {
        $this->assertFalse(CarrierShipmentStatus::InTransit->isTerminal());
    }

    #[Test]
    public function out_for_delivery_is_not_terminal(): void
    {
        $this->assertFalse(CarrierShipmentStatus::OutForDelivery->isTerminal());
    }

    #[Test]
    public function unknown_is_not_terminal(): void
    {
        $this->assertFalse(CarrierShipmentStatus::Unknown->isTerminal());
    }
}
