<?php

/**
 * Integration tests for the inbound carrier webhook endpoint's HMAC-SHA256
 * signature verification and its downstream Dispatch state transition.
 *
 * ASSUMPTIONS (adjust to match the real Phase 7 implementation):
 *  - Route POST /api/v1/webhooks/carrier/{carrier} exists and "mock_carrier"
 *    is a valid, routable carrier slug in this environment
 *  - App\Models\Dispatch has: tracking_number, status
 *  - App\Events\DispatchMovementUpdated exposes a public `dispatch` property
 *    referencing the updated Dispatch model
 *  - The secret is read from config('services.carriers.mock_carrier.webhook_secret');
 *    it's pinned below in setUp() so this test doesn't depend on whatever is
 *    (or isn't) in .env.testing
 *
 * SECURITY NOTE: verify signatures against the raw request body
 * ($request->getContent()), compared with hash_equals() for a timing-safe
 * check — not against a re-encoded json_encode($request->all()) value,
 * which can silently diverge from what a real carrier signed (key order,
 * whitespace, unicode escaping). This test signs the exact payload it
 * sends, so it will pass either way; it doesn't by itself prove the
 * controller checks the raw body rather than a re-serialized copy.
 */

namespace Tests\Feature\Logistics;

use App\Events\DispatchMovementUpdated;
use App\Models\Dispatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;
use App\Enums\Logistics\CarrierShipmentStatus;

class CarrierWebhookSecurityTest extends TestCase
{
    use RefreshDatabase;

    private const WEBHOOK_URL = '/api/v1/webhooks/carrier/mock_carrier';

    protected function setUp(): void
    {
        parent::setUp();

        // Pinned locally so this test never depends on .env.testing having
        // (or not having) a real secret configured.
        config(['services.carriers.mock_carrier.webhook_secret' => 'test-mock-carrier-webhook-secret']);
    }

    private function payloadFor(Dispatch $dispatch): array
    {
        return [
            // Harmonized with our exact Phase 7 database column keys
            'carrier_waybill_reference' => $dispatch->carrier_waybill_reference ?? 'WB-MOCK-' . uniqid(),
            'status' => \App\Enums\Logistics\CarrierShipmentStatus::InTransit->value,
            'status_timestamp' => now()->toIso8601String(),
            'location_description' => 'DC4-Distribution Scanned',
            'latitude' => 37.8044,
            'longitude' => -122.2712,
            'raw_carrier_status_code' => 'IN_TRANSIT_HUB_SCAN'
        ];
    }


    private function signatureFor(array $payload): string
    {
        return hash_hmac(
            'sha256',
            json_encode($payload),
            config('services.carriers.mock_carrier.webhook_secret')
        );
    }

    #[Test]
    public function missing_signature_header_is_rejected_without_side_effects(): void
    {
        Event::fake([DispatchMovementUpdated::class]);

        $dispatch = Dispatch::factory()->create(['status' => CarrierShipmentStatus::Unknown->value]);

        $response = $this->postJson(self::WEBHOOK_URL, $this->payloadFor($dispatch));

        $response->assertUnauthorized();

        $this->assertDatabaseHas('dispatches', [
            'id' => $dispatch->id,
            'status' => CarrierShipmentStatus::Unknown->value,

        ]);

        Event::assertNotDispatched(DispatchMovementUpdated::class);
    }

    #[Test]
    public function invalid_signature_header_is_rejected_without_side_effects(): void
    {
        Event::fake([DispatchMovementUpdated::class]);

        $dispatch = Dispatch::factory()->create(['status' => CarrierShipmentStatus::Unknown->value]);

        $response = $this->postJson(self::WEBHOOK_URL, $this->payloadFor($dispatch), [
            'X-Carrier-Signature' => str_repeat('0', 64),
        ]);

        $response->assertUnauthorized();

        $this->assertDatabaseHas('dispatches', [
            'id' => $dispatch->id,
            'status' => CarrierShipmentStatus::Unknown->value,
        ]);

        Event::assertNotDispatched(DispatchMovementUpdated::class);
    }

    #[Test]
    public function valid_signature_updates_dispatch_and_fires_movement_event(): void
    {
        Event::fake([DispatchMovementUpdated::class]);

        $dispatch = Dispatch::factory()->create(['status' => CarrierShipmentStatus::Unknown->value, 'carrier_waybill_reference' => 'WB-MOCK-Test-123']);
        $payload = $this->payloadFor($dispatch);
        $payload['carrier_waybill_reference'] = 'WB-MOCK-Test-123';

        $response = $this->postJson(self::WEBHOOK_URL, $payload, [
            'X-Carrier-Signature' => $this->signatureFor($payload),
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('dispatches', [
            'id' => $dispatch->id,
            'status' => CarrierShipmentStatus::InTransit->value,
        ]);

        Event::assertDispatched(
            DispatchMovementUpdated::class,
            fn($event) => $event->dispatch->is($dispatch)
        );
    }

    #[Test]
    public function tampering_with_the_payload_after_signing_invalidates_the_signature(): void
    {
        Event::fake([DispatchMovementUpdated::class]);

        $dispatch = Dispatch::factory()->create(['status' => CarrierShipmentStatus::Unknown->value]);
        $payload = $this->payloadFor($dispatch);
        $signature = $this->signatureFor($payload);

        // Sign first, then mutate — proves verification is keyed to content,
        // not merely to the presence of a well-formed header.
        $payload['status'] = CarrierShipmentStatus::Delivered->value;

        $response = $this->postJson(self::WEBHOOK_URL, $payload, [
            'X-Carrier-Signature' => $signature,
        ]);

        $response->assertUnauthorized();

        $this->assertDatabaseHas('dispatches', [
            'id' => $dispatch->id,
            'status' => CarrierShipmentStatus::Unknown->value,
        ]);

        Event::assertNotDispatched(DispatchMovementUpdated::class);
    }
}
