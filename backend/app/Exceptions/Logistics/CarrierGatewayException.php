<?php

declare(strict_types=1);

namespace App\Exceptions\Logistics;

use RuntimeException;
use Throwable;

/**
 * Single, vendor-agnostic exception type thrown by every
 * LogisticsGatewayInterface implementation.
 *
 * Calling code that talks to the gateway through the interface never needs
 * to know or catch a vendor-specific exception (a Guzzle exception, a
 * FedEx SDK exception, etc.) — every adapter normalizes its failures into
 * one of the named constructors below before the exception leaves the
 * adapter boundary. The constructor is private on purpose: construction
 * always goes through a named factory so every instance carries
 * structured context, not just a free-text message.
 */
final class CarrierGatewayException extends RuntimeException
{
    private function __construct(
        string $message,
        private readonly string $carrierName,
        private readonly ?int $httpStatusCode = null,
        private readonly ?string $carrierReference = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    /**
     * The underlying transport call never completed (DNS, TLS, timeout,
     * connection refused, etc.).
     */
    public static function connectionFailed(string $carrierName, Throwable $previous): self
    {
        return new self(
            sprintf('Connection to carrier "%s" failed: %s', $carrierName, $previous->getMessage()),
            $carrierName,
            previous: $previous,
        );
    }

    /**
     * The carrier was reached but rejected our credentials or signature.
     */
    public static function authenticationFailed(string $carrierName, ?int $httpStatusCode = null): self
    {
        return new self(
            sprintf('Carrier "%s" rejected our credentials.', $carrierName),
            $carrierName,
            httpStatusCode: $httpStatusCode,
        );
    }

    /**
     * The carrier understood the request but declined the manifest itself
     * (invalid address, unsupported service area, capacity, etc.).
     */
    public static function manifestRejected(string $carrierName, string $reason, ?string $carrierReference = null): self
    {
        return new self(
            sprintf('Carrier "%s" rejected the manifest: %s', $carrierName, $reason),
            $carrierName,
            carrierReference: $carrierReference,
        );
    }

    /**
     * A tracking pull referenced a waybill the carrier has no record of.
     */
    public static function unknownWaybillReference(string $carrierName, string $carrierWaybillReference): self
    {
        return new self(
            sprintf('Carrier "%s" has no record of waybill reference "%s".', $carrierName, $carrierWaybillReference),
            $carrierName,
            carrierReference: $carrierWaybillReference,
        );
    }

    /**
     * The carrier responded, but the payload didn't match the shape the
     * adapter expected (missing fields, unexpected schema, an HTML error
     * page instead of JSON, etc.).
     */
    public static function malformedResponse(string $carrierName, string $detail, ?Throwable $previous = null): self
    {
        return new self(
            sprintf('Carrier "%s" returned an unexpected response: %s', $carrierName, $detail),
            $carrierName,
            previous: $previous,
        );
    }

    /**
     * Catch-all for a failure that doesn't fit one of the named cases
     * above — still forces a carrier name and keeps the original
     * throwable attached where available.
     */
    public static function from(string $carrierName, string $message, ?Throwable $previous = null): self
    {
        return new self($message, $carrierName, previous: $previous);
    }

    public function carrierName(): string
    {
        return $this->carrierName;
    }

    public function httpStatusCode(): ?int
    {
        return $this->httpStatusCode;
    }

    public function carrierReference(): ?string
    {
        return $this->carrierReference;
    }

    /**
     * Recognized by Laravel's exception handler and merged automatically
     * into the log entry's context array.
     *
     * @return array{carrier: string, http_status: int|null, carrier_reference: string|null}
     */
    public function context(): array
    {
        return [
            'carrier' => $this->carrierName,
            'http_status' => $this->httpStatusCode,
            'carrier_reference' => $this->carrierReference,
        ];
    }
}
