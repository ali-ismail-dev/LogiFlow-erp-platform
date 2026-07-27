<?php

declare(strict_types=1);

namespace Tests\Unit\Enums;

use App\Enums\OrderStatus;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class OrderStatusTest extends TestCase
{
    #[Test]
    public function it_has_expected_cases(): void
    {
        $this->assertSame('pending', OrderStatus::Pending->value);
        $this->assertSame('processing', OrderStatus::Processing->value);
        $this->assertSame('dispatched', OrderStatus::Dispatched->value);
        $this->assertSame('delivered', OrderStatus::Delivered->value);
        $this->assertSame('cancelled', OrderStatus::Cancelled->value);
    }

    #[Test]
    public function pending_is_dispatchable(): void
    {
        $this->assertTrue(OrderStatus::Pending->isDispatchable());
    }

    #[Test]
    public function processing_is_dispatchable(): void
    {
        $this->assertTrue(OrderStatus::Processing->isDispatchable());
    }

    #[Test]
    public function dispatched_is_not_dispatchable(): void
    {
        $this->assertFalse(OrderStatus::Dispatched->isDispatchable());
    }

    #[Test]
    public function delivered_is_not_dispatchable(): void
    {
        $this->assertFalse(OrderStatus::Delivered->isDispatchable());
    }

    #[Test]
    public function cancelled_is_not_dispatchable(): void
    {
        $this->assertFalse(OrderStatus::Cancelled->isDispatchable());
    }
}
