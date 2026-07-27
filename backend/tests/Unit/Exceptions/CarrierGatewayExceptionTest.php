<?php

declare(strict_types=1);

namespace Tests\Unit\Exceptions;

use App\Exceptions\Logistics\CarrierGatewayException;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class CarrierGatewayExceptionTest extends TestCase
{
    #[Test]
    public function connection_factory(): void
    {
        $previous = new RuntimeException('Connection timed out');
        $e = CarrierGatewayException::connectionFailed('fedex', $previous);

        $this->assertStringContainsString('fedex', $e->getMessage());
        $this->assertStringContainsString('Connection timed out', $e->getMessage());
        $this->assertSame($previous, $e->getPrevious());
        $this->assertSame('fedex', $e->carrierName());
        $this->assertNull($e->httpStatusCode());
        $this->assertNull($e->carrierReference());
    }

    #[Test]
    public function authentication_factory(): void
    {
        $e = CarrierGatewayException::authenticationFailed('ups', 401);

        $this->assertStringContainsString('ups', $e->getMessage());
        $this->assertSame('ups', $e->carrierName());
        $this->assertSame(401, $e->httpStatusCode());
        $this->assertNull($e->carrierReference());
    }

    #[Test]
    public function manifest_rejected_factory(): void
    {
        $e = CarrierGatewayException::manifestRejected('fedex', 'Invalid address', 'REF-123');

        $this->assertStringContainsString('fedex', $e->getMessage());
        $this->assertStringContainsString('Invalid address', $e->getMessage());
        $this->assertSame('fedex', $e->carrierName());
        $this->assertNull($e->httpStatusCode());
        $this->assertSame('REF-123', $e->carrierReference());
    }

    #[Test]
    public function unknown_waybill_reference_factory(): void
    {
        $e = CarrierGatewayException::unknownWaybillReference('ups', 'WB-456');

        $this->assertStringContainsString('ups', $e->getMessage());
        $this->assertStringContainsString('WB-456', $e->getMessage());
        $this->assertSame('ups', $e->carrierName());
        $this->assertNull($e->httpStatusCode());
        $this->assertSame('WB-456', $e->carrierReference());
    }

    #[Test]
    public function malformed_response_factory(): void
    {
        $previous = new RuntimeException('Parse error');
        $e = CarrierGatewayException::malformedResponse('fedex', 'Expected JSON, got HTML', $previous);

        $this->assertStringContainsString('fedex', $e->getMessage());
        $this->assertStringContainsString('Expected JSON', $e->getMessage());
        $this->assertSame($previous, $e->getPrevious());
        $this->assertSame('fedex', $e->carrierName());
    }

    #[Test]
    public function from_factory(): void
    {
        $previous = new RuntimeException('Generic error');
        $e = CarrierGatewayException::from('dhl', 'Something went wrong', $previous);

        $this->assertSame('Something went wrong', $e->getMessage());
        $this->assertSame($previous, $e->getPrevious());
        $this->assertSame('dhl', $e->carrierName());
    }

    #[Test]
    public function context_includes_carrier_details(): void
    {
        $e = CarrierGatewayException::authenticationFailed('ups', 403);

        $context = $e->context();
        $this->assertSame('ups', $context['carrier']);
        $this->assertSame(403, $context['http_status']);
        $this->assertNull($context['carrier_reference']);
    }

    #[Test]
    public function it_extends_runtime_exception(): void
    {
        $e = CarrierGatewayException::from('test', 'msg');
        $this->assertInstanceOf(RuntimeException::class, $e);
    }
}
