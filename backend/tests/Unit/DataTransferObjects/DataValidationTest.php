<?php

declare(strict_types=1);

namespace Tests\Unit\DataTransferObjects;

use App\DataTransferObjects\DispatchOrdersData;
use App\DataTransferObjects\Logistics\CarrierManifestRequest;
use App\DataTransferObjects\Logistics\CarrierManifestResult;
use App\DataTransferObjects\Logistics\CarrierManifestStopRequest;
use App\DataTransferObjects\Logistics\CarrierTrackingUpdate;
use App\DataTransferObjects\StopData;
use App\Enums\Logistics\CarrierShipmentStatus;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class DataValidationTest extends TestCase
{
    #[Test]
    public function it_hydrates_dispatch_orders_data_from_array(): void
    {
        $payload = [
            'warehouse_id' => 7,
            'reference_code' => 'REF-42',
            'driver_name' => 'A. Driver',
            'vehicle_identifier' => 'TRK-01',
            'scheduled_at' => '2026-01-01T08:00:00+00:00',
            'stops' => [
                [
                    'order_id' => 21,
                    'sequence' => 1,
                    'destination_address' => ['line1' => '10 Main St'],
                ],
            ],
        ];

        $data = DispatchOrdersData::fromArray($payload);

        $this->assertSame(7, $data->warehouseId);
        $this->assertSame('REF-42', $data->referenceCode);
        $this->assertSame(1, $data->stopCount());
        $this->assertInstanceOf(StopData::class, $data->stops[0]);
        $this->assertSame(21, $data->stops[0]->orderId);
    }

    #[Test]
    public function it_serializes_a_carrier_manifest_request_to_array(): void
    {
        $request = new CarrierManifestRequest(
            dispatchReference: 'DSP-100',
            stops: [new CarrierManifestStopRequest(1, 'Jane Doe', '100 Main St', 'Suite 3', 'Toronto', 'M5V 2T6', 'CA', '555-1234', 2.5)],
            totalWeightKg: 12.5,
            requestedPickupAt: new DateTimeImmutable('2026-01-01T09:00:00+00:00'),
        );

        $this->assertSame([
            'dispatch_reference' => 'DSP-100',
            'stops' => [[
                'sequence' => 1,
                'recipient_name' => 'Jane Doe',
                'address_line_1' => '100 Main St',
                'address_line_2' => 'Suite 3',
                'city' => 'Toronto',
                'postal_code' => 'M5V 2T6',
                'country_code' => 'CA',
                'phone_number' => '555-1234',
                'parcel_weight_kg' => 2.5,
            ]],
            'total_weight_kg' => 12.5,
            'requested_pickup_at' => '2026-01-01T09:00:00+00:00',
        ], $request->toArray());
    }

    #[Test]
    public function it_rejects_invalid_carrier_manifest_request_values(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new CarrierManifestRequest(
            dispatchReference: ' ',
            stops: [],
            totalWeightKg: 0.0,
        );
    }

    #[Test]
    public function it_serializes_a_carrier_manifest_result_to_array(): void
    {
        $result = new CarrierManifestResult(
            carrierWaybillReference: 'WAYBILL-001',
            carrierName: 'Acme Carrier',
            accepted: true,
            submittedAt: new DateTimeImmutable('2026-01-01T09:30:00+00:00'),
        );

        $this->assertSame([
            'carrier_waybill_reference' => 'WAYBILL-001',
            'carrier_name' => 'Acme Carrier',
            'accepted' => true,
            'submitted_at' => '2026-01-01T09:30:00+00:00',
            'rejection_reason' => null,
        ], $result->toArray());
    }

    #[Test]
    public function it_rejects_invalid_carrier_manifest_result_values(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new CarrierManifestResult(' ', ' ', false, new DateTimeImmutable('2026-01-01T09:30:00+00:00'));
    }

    #[Test]
    public function it_serializes_a_carrier_manifest_stop_request_to_array(): void
    {
        $stop = new CarrierManifestStopRequest(2, 'John Doe', '200 Main St', null, 'Vancouver', 'V6B 2W5', 'CA', '555-4321', 3.75);

        $this->assertSame([
            'sequence' => 2,
            'recipient_name' => 'John Doe',
            'address_line_1' => '200 Main St',
            'address_line_2' => null,
            'city' => 'Vancouver',
            'postal_code' => 'V6B 2W5',
            'country_code' => 'CA',
            'phone_number' => '555-4321',
            'parcel_weight_kg' => 3.75,
        ], $stop->toArray());
    }

    #[Test]
    public function it_rejects_invalid_carrier_manifest_stop_request_values(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new CarrierManifestStopRequest(0, 'John Doe', '200 Main St', null, 'Vancouver', 'V6B 2W5', 'USA', '555-4321', 0.0);
    }

    #[Test]
    public function it_serializes_a_carrier_tracking_update_to_array(): void
    {
        $update = new CarrierTrackingUpdate(
            carrierWaybillReference: 'WAYBILL-007',
            status: CarrierShipmentStatus::InTransit,
            statusTimestamp: new DateTimeImmutable('2026-01-01T10:15:00+00:00'),
            carrierName: 'Acme Carrier',
            locationDescription: 'Near depot',
            latitude: 43.7,
            longitude: -79.4,
            rawCarrierStatusCode: 'IT',
        );

        $this->assertSame([
            'carrier_waybill_reference' => 'WAYBILL-007',
            'status' => 'in_transit',
            'status_timestamp' => '2026-01-01T10:15:00+00:00',
            'carrier_name' => 'Acme Carrier',
            'location_description' => 'Near depot',
            'latitude' => 43.7,
            'longitude' => -79.4,
            'raw_carrier_status_code' => 'IT',
        ], $update->toArray());
    }

    #[Test]
    public function it_rejects_invalid_carrier_tracking_update_coordinates(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new CarrierTrackingUpdate(
            carrierWaybillReference: 'WAYBILL-8',
            status: CarrierShipmentStatus::PickedUp,
            statusTimestamp: new DateTimeImmutable('2026-01-01T10:15:00+00:00'),
            latitude: 43.7,
        );
    }
}
