<?php

declare(strict_types=1);

namespace App\Contracts;

use App\DataTransferObjects\Logistics\CarrierManifestRequest;
use App\DataTransferObjects\Logistics\CarrierManifestResult;
use App\DataTransferObjects\Logistics\CarrierTrackingUpdate;
use App\Exceptions\Logistics\CarrierGatewayException;

/**
 * Anti-corruption boundary between LogiFlow's domain and any external
 * courier / carrier API.
 *
 * Every concrete adapter (FedEx, DHL, a regional courier, or the Phase 7
 * mock carrier behind the webhook simulator) implements this contract and
 * is solely responsible for translating between the vendor's wire format
 * and the DTOs declared here. No calling code should ever type-hint a
 * concrete adapter or a vendor SDK class directly — only this interface.
 *
 * Both methods accept and return strictly-typed values only: a primitive
 * scalar for the simple identifier lookup, and immutable DTOs for anything
 * structured. This keeps vendor-specific arrays or SDK objects from ever
 * leaking past the adapter boundary into domain or application code.
 */
interface LogisticsGatewayInterface
{
    /**
     * Submit a fully-assembled manifest to the carrier for pickup/delivery.
     *
     * Implementations must translate the given vendor-agnostic manifest
     * into whatever wire format the carrier expects, perform the call, and
     * translate the carrier's response back into a CarrierManifestResult.
     * A manifest is inherently structured data (ordered stops, addresses,
     * weights), so it is represented here as a DTO rather than flattened
     * into a long scalar parameter list — the strict typing lives on the
     * DTO's own properties.
     *
     * @throws CarrierGatewayException When the carrier rejects the
     *         manifest outright, or the integration call itself fails
     *         (timeout, authentication failure, malformed vendor response).
     */
    public function submitManifest(CarrierManifestRequest $manifest): CarrierManifestResult;

    /**
     * Pull the current tracking/waybill status for a previously submitted
     * manifest, identified by the carrier's own waybill reference (the
     * value returned as CarrierManifestResult::$carrierWaybillReference at
     * submission time).
     *
     * @param non-empty-string $carrierWaybillReference
     *
     * @throws CarrierGatewayException When the reference is unknown to the
     *         carrier, or the integration call itself fails.
     */
    public function pullTrackingStatus(string $carrierWaybillReference): CarrierTrackingUpdate;
}
