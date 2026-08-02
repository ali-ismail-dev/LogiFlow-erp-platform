<?php

declare(strict_types=1);

namespace Tests\Unit\Events;

use App\Enums\DispatchStatus;
use App\Events\DispatchMovementUpdated;
use App\Models\Dispatch;
use App\Models\Stop;
use App\Models\Tenant;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class DispatchMovementUpdatedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $tenant = Tenant::factory()->create();
        app(\App\Support\Tenancy\TenantManager::class)->setTenantId($tenant->id);
    }

    #[Test]
    public function it_broadcasts_on_the_correct_tenant_private_channel(): void
    {
        $dispatch = Dispatch::factory()->create();
        $event = new DispatchMovementUpdated($dispatch);

        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertEquals('private-tenant.' . $dispatch->tenant_id . '.ops', $channels[0]->name);
    }

    #[Test]
    public function it_broadcasts_as_the_correct_event_name(): void
    {
        $dispatch = Dispatch::factory()->create();
        $event = new DispatchMovementUpdated($dispatch);

        $this->assertEquals('dispatch.movement.updated', $event->broadcastAs());
    }

    #[Test]
    public function it_builds_the_broadcast_payload_with_driver_and_stop(): void
    {
        $warehouse = Warehouse::factory()->create();
        $dispatch = Dispatch::factory()->create([
            'warehouse_id' => $warehouse->id,
            'reference_code' => 'DSP-TEST-100',
            'driver_name' => 'Brian OConner',
            'vehicle_identifier' => 'SUPRA-94',
            'status' => DispatchStatus::InTransit->value,
        ]);

        $stop = Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'sequence' => 1,
            'status' => \App\Enums\StopStatus::Pending,
        ]);

        $event = new DispatchMovementUpdated($dispatch);
        $payload = $event->broadcastWith();

        $this->assertEquals($dispatch->id, $payload['id']);
        $this->assertEquals($dispatch->tenant_id, $payload['tenant_id']);
        $this->assertEquals('in_transit', $payload['status']);

        // FIXED: Asserts our verified database schema keys instead of legacy reference_number
        $this->assertEquals('DSP-TEST-100', $payload['reference_code']);
        $this->assertEquals('SUPRA-94', $payload['vehicle_identifier']);
        $this->assertEquals('Brian OConner', $payload['driver_name']);

        $this->assertNotNull($payload['current_stop']);
        $this->assertEquals($stop->id, $payload['current_stop']['id']);
        $this->assertEquals('pending', $payload['current_stop']['status']);

        $this->assertNotNull($payload['warehouse']);
        $this->assertEquals($warehouse->id, $payload['warehouse']['id']);
    }

    #[Test]
    public function it_builds_the_broadcast_payload_without_driver_and_stop(): void
    {
        $dispatch = Dispatch::factory()->create([
            'reference_code' => 'DSP-TEST-200',
            'driver_name' => null,
            'vehicle_identifier' => null,
            'status' => DispatchStatus::Planned->value,
        ]);

        $event = new DispatchMovementUpdated($dispatch);
        $payload = $event->broadcastWith();

        $this->assertEquals($dispatch->id, $payload['id']);
        // FIXED: Asserts unified keys matching our verified model serializer
        $this->assertEquals('DSP-TEST-200', $payload['reference_code']);
        $this->assertNull($payload['vehicle_identifier']);
        $this->assertNull($payload['driver_name']);
        $this->assertNull($payload['current_stop']);
    }
}
