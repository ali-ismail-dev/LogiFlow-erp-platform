<?php

declare(strict_types=1);

namespace Tests\Unit\Exceptions;

use App\Exceptions\TenantContextNotResolvedException;
use App\Exceptions\DomainException;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class TenantContextNotResolvedExceptionTest extends TestCase
{
    #[Test]
    public function for_model_includes_the_model_class(): void
    {
        $e = TenantContextNotResolvedException::forModel('App\Models\Dispatch');

        $this->assertStringContainsString('App\Models\Dispatch', $e->getMessage());
    }

    #[Test]
    public function for_route_includes_the_route(): void
    {
        $e = TenantContextNotResolvedException::forRoute('api/dispatches');

        $this->assertStringContainsString('api/dispatches', $e->getMessage());
    }

    #[Test]
    public function it_extends_domain_exception(): void
    {
        $e = TenantContextNotResolvedException::forModel('App\Models\Order');
        $this->assertInstanceOf(DomainException::class, $e);
    }
}
