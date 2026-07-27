<?php

declare(strict_types=1);

namespace Tests\Unit\Events;

use App\Events\DispatchMovementUpdated;
use App\Models\Dispatch;
use App\Models\Stop;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DispatchMovementUpdatedTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    /**
     * Bootstrap a consistent tenant context for every test that persists
     * to the database, satisfying the TenantScope global query filter.
     *
     * Tests 1 and 2 operate exclusively on in-memory models and do not
     * touch the database, so they are unaffected by tenancy; the setUp
     * here is harmless for them and critical for tests 3 and 4.
     */
    protected function setUp(): void
    {
        parent::setUp();

        // The TenantManager is bound as a scoped singleton in the container.
        // We create a real tenant row (needed by FK constraints in other
        // tables) and resolve it so that TenantScope does not throw.
        $this->tenant = Tenant::factory()->create();

        app(TenantManager::class)->resolve($this->tenant);
    }

    protected function tearDown(): void
    {
        app(TenantManager::class)->forget();

        parent::tearDown();
    }

    #[Test]
    public function it_broadcasts_on_the_correct_tenant_private_channel(): void
    {
        $dispatch = new Dispatch(['tenant_id' => 789]);
        $event = new DispatchMovementUpdated($dispatch);

        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertEquals('private-tenant.789.ops', $channels[0]->name);
    }

    #[Test]
    public function it_broadcasts_as_the_correct_event_name(): void
    {
        $dispatch = new Dispatch();
        $event = new DispatchMovementUpdated($dispatch);

        $this->assertEquals('dispatch.movement.updated', $event->broadcastAs());
    }

    #[Test]
    public function it_builds_the_broadcast_payload_with_driver_and_stop(): void
    {
        // Rely on the factory cascade, seeded with the setUp-resolved tenant,
        // to build valid Tenant and Warehouse relations satisfying PgSQL FK
        // constraints. The TenantManager is already populated so the factory
        // definitions use $tenantManager->id instead of creating orphan tenants.
        $dispatch = Dispatch::factory()->create([
            'status' => 'in_transit',
            'driver_name' => 'Sarah Connor',
        ]);

        // Dynamically assigning to match the event's property call
        $dispatch->reference_number = 'REF-001';

        // Create a stop anchored to the same dispatch and tenant.
        // The tenant_id is explicitly passed so the BelongsToTenant::creating
        // hook short-circuits (it already matches the resolved context).
        $stop = Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'tenant_id' => $dispatch->tenant_id,
            'sequence' => 2,
            'label' => 'Warehouse B Dropoff',
            'eta' => now()->addHours(2),
        ]);

        $event = new DispatchMovementUpdated($dispatch);
        $payload = $event->broadcastWith();

        $this->assertEquals($dispatch->id, $payload['id']);
        $this->assertEquals($dispatch->tenant_id, $payload['tenant_id']);
        $this->assertEquals('in_transit', $payload['status']);
        $this->assertEquals('REF-001', $payload['reference_number']);
        $this->assertEquals($dispatch->updated_at->toIso8601String(), $payload['updated_at']);

        // Assert Stop Payload
        $this->assertIsArray($payload['current_stop']);
        $this->assertEquals($stop->id, $payload['current_stop']['id']);
        $this->assertEquals(2, $payload['current_stop']['sequence']);
        $this->assertEquals('Warehouse B Dropoff', $payload['current_stop']['label']);

        $expectedStatus = $stop->status instanceof \BackedEnum ? $stop->status->value : (string) $stop->status;
        $this->assertEquals($expectedStatus, $payload['current_stop']['status']);

        $this->assertEquals($stop->eta->toIso8601String(), $payload['current_stop']['eta']);

        // Assert Driver Payload
        $this->assertIsArray($payload['driver']);
        $this->assertEquals($dispatch->id, $payload['driver']['id']);
        $this->assertEquals('Sarah Connor', $payload['driver']['name']);
    }

    #[Test]
    public function it_builds_the_broadcast_payload_without_driver_and_stop(): void
    {
        $dispatch = Dispatch::factory()->create([
            'driver_name' => null,
        ]);
        $dispatch->reference_number = 'REF-002';

        // The factory cascade may have created stops via Order/Tenant
        // relationships. Explicitly delete them without the tenant scope
        // to guarantee a clean slate for the "null stop" assertion.
        Stop::withoutTenancy()->where('dispatch_id', $dispatch->id)->delete();

        // Nullify updated_at to test the optional() fallback chain in the payload map
        $dispatch->updated_at = null;

        $event = new DispatchMovementUpdated($dispatch);
        $payload = $event->broadcastWith();

        $this->assertNull($payload['current_stop']);
        $this->assertNull($payload['driver']);
        $this->assertNull($payload['updated_at']);
    }
}
