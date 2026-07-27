<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Enums\Logistics\CarrierShipmentStatus;
use App\Events\DispatchMovementUpdated;
use App\Models\Dispatch;
use App\Models\Stop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CarrierWebhookControllerTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'test-webhook-secret-123';
    private const CARRIER = 'mock_carrier';

    protected function setUp(): void
    {
        parent::setUp();

        // Bind the secret into the config exactly as the controller expects
        config(["services.carriers." . self::CARRIER . ".webhook_secret" => self::SECRET]);
    }

    /**
     * Helper to generate signed webhook payload.
     */
    private function postSignedWebhook(array $payload, ?string $overrideSecret = null)
    {
        $content = json_encode($payload);
        $secret = $overrideSecret ?? self::SECRET;
        $signature = hash_hmac('sha256', $content, $secret);

        return $this->postJson(
            "/api/v1/webhooks/carrier/" . self::CARRIER,
            $payload,
            ['X-Carrier-Signature' => $signature]
        );
    }

    #[Test]
    public function it_fails_if_carrier_secret_is_not_configured(): void
    {
        // Wipe the secret from config
        config(["services.carriers." . self::CARRIER . ".webhook_secret" => '']);

        $response = $this->postSignedWebhook([
            'carrier_waybill_reference' => 'WAYBILL-123',
            'status' => CarrierShipmentStatus::InTransit->value,
            'status_timestamp' => now()->toIso8601String(),
        ]);

        $response->assertStatus(401)
            ->assertJson(['message' => 'Invalid or missing carrier webhook signature.']);
    }

    #[Test]
    public function it_returns_404_if_dispatch_is_not_found(): void
    {
        $response = $this->postSignedWebhook([
            'carrier_waybill_reference' => 'NONEXISTENT-WAYBILL',
            'status' => CarrierShipmentStatus::InTransit->value,
            'status_timestamp' => now()->toIso8601String(),
        ]);

        $response->assertStatus(404)
            ->assertJson(['message' => 'No dispatch found for the given carrier waybill reference.']);
    }

    #[Test]
    public function it_returns_422_if_stop_sequence_is_provided_but_not_found(): void
    {
        $dispatch = Dispatch::factory()->create([
            'carrier_waybill_reference' => 'WAYBILL-422',
        ]);

        $response = $this->postSignedWebhook([
            'carrier_waybill_reference' => $dispatch->carrier_waybill_reference,
            'stop_sequence' => 99, // Does not exist
            'status' => CarrierShipmentStatus::InTransit->value,
            'status_timestamp' => now()->toIso8601String(),
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => "Dispatch #{$dispatch->id} has no stop with sequence 99."]);
    }

    #[Test]
    public function it_applies_dispatch_level_update_and_cascades_to_non_terminal_stops(): void
    {
        Event::fake([DispatchMovementUpdated::class]);

        $dispatch = Dispatch::factory()->create(['carrier_waybill_reference' => 'WAYBILL-CASCADE']);

        $activeStop = Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'tenant_id' => $dispatch->tenant_id,
            'sequence' => 1,
            'status' => CarrierShipmentStatus::PickedUp->value
        ]);

        $terminalStop = Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'tenant_id' => $dispatch->tenant_id,
            'sequence' => 2,
            'status' => CarrierShipmentStatus::Delivered->value
        ]);

        $response = $this->postSignedWebhook([
            'carrier_waybill_reference' => $dispatch->carrier_waybill_reference,
            'status' => CarrierShipmentStatus::InTransit->value,
            'status_timestamp' => now()->toIso8601String(),
        ]);

        $response->assertStatus(200);

        $this->assertEquals(CarrierShipmentStatus::InTransit->value, $dispatch->fresh()->status->value);
        $this->assertEquals(CarrierShipmentStatus::InTransit->value, $activeStop->fresh()->status->value);

        // Ensure terminal stop was ignored in the cascade
        $this->assertEquals(CarrierShipmentStatus::Delivered->value, $terminalStop->fresh()->status->value);

        Event::assertDispatched(DispatchMovementUpdated::class);
    }

    #[Test]
    public function it_recomputes_dispatch_as_delivered_when_final_stop_is_delivered(): void
    {
        Event::fake([DispatchMovementUpdated::class]);

        $dispatch = Dispatch::factory()->create(['carrier_waybill_reference' => 'WAYBILL-DELIVER']);

        // Already delivered
        Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'tenant_id' => $dispatch->tenant_id,
            'sequence' => 1,
            'status' => CarrierShipmentStatus::Delivered->value
        ]);

        // Will be delivered by the webhook
        $finalStop = Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'tenant_id' => $dispatch->tenant_id,
            'sequence' => 2,
            'status' => CarrierShipmentStatus::OutForDelivery->value
        ]);

        $response = $this->postSignedWebhook([
            'carrier_waybill_reference' => $dispatch->carrier_waybill_reference,
            'stop_sequence' => 2,
            'status' => CarrierShipmentStatus::Delivered->value,
            'status_timestamp' => now()->toIso8601String(),
        ]);

        $response->assertStatus(200);
        $this->assertEquals(CarrierShipmentStatus::Delivered->value, $finalStop->fresh()->status->value);

        // Recomputation should see all stops are Delivered
        $this->assertEquals(CarrierShipmentStatus::Delivered->value, $dispatch->fresh()->status->value);
    }

    #[Test]
    public function it_recomputes_dispatch_as_delivery_failed_when_all_stops_terminal_and_one_fails(): void
    {
        $dispatch = Dispatch::factory()->create(['carrier_waybill_reference' => 'WAYBILL-FAIL']);

        Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'tenant_id' => $dispatch->tenant_id,
            'sequence' => 1,
            'status' => CarrierShipmentStatus::Delivered->value
        ]);

        // Will fail via webhook
        Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'tenant_id' => $dispatch->tenant_id,
            'sequence' => 2,
            'status' => CarrierShipmentStatus::OutForDelivery->value
        ]);

        $response = $this->postSignedWebhook([
            'carrier_waybill_reference' => $dispatch->carrier_waybill_reference,
            'stop_sequence' => 2,
            'status' => CarrierShipmentStatus::DeliveryFailed->value,
            'status_timestamp' => now()->toIso8601String(),
        ]);

        $response->assertStatus(200);
        $this->assertEquals(CarrierShipmentStatus::DeliveryFailed->value, $dispatch->fresh()->status->value);
    }

    #[Test]
    public function it_recomputes_dispatch_as_latest_status_when_stops_are_not_all_terminal(): void
    {
        $dispatch = Dispatch::factory()->create(['carrier_waybill_reference' => 'WAYBILL-LATEST']);

        Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'tenant_id' => $dispatch->tenant_id,
            'sequence' => 1,
            'status' => CarrierShipmentStatus::Unknown->value
        ]);

        Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'tenant_id' => $dispatch->tenant_id,
            'sequence' => 2,
            'status' => CarrierShipmentStatus::Unknown->value
        ]);

        $response = $this->postSignedWebhook([
            'carrier_waybill_reference' => $dispatch->carrier_waybill_reference,
            'stop_sequence' => 1,
            'status' => CarrierShipmentStatus::PickedUp->value,
            'status_timestamp' => now()->toIso8601String(),
        ]);

        $response->assertStatus(200);

        // Stop 2 is still pending (not terminal), so it just adopts the latest webhook status
        $this->assertEquals(CarrierShipmentStatus::PickedUp->value, $dispatch->fresh()->status->value);
    }
}
