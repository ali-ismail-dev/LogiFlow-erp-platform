<?php

declare(strict_types=1);

namespace Tests\Unit\Exceptions;

use App\Exceptions\OrderNotDispatchableException;
use App\Exceptions\DomainException;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class OrderNotDispatchableExceptionTest extends TestCase
{
    #[Test]
    public function for_order_includes_order_number_and_status(): void
    {
        $e = OrderNotDispatchableException::forOrder('ORD-001', 'cancelled');

        $this->assertStringContainsString('ORD-001', $e->getMessage());
        $this->assertStringContainsString('cancelled', $e->getMessage());
    }

    #[Test]
    public function not_found_in_tenant_includes_order_id(): void
    {
        $e = OrderNotDispatchableException::notFoundInTenant(42);

        $this->assertStringContainsString('42', $e->getMessage());
    }

    #[Test]
    public function it_extends_domain_exception(): void
    {
        $e = OrderNotDispatchableException::forOrder('ORD-001', 'pending');
        $this->assertInstanceOf(DomainException::class, $e);
    }
}
