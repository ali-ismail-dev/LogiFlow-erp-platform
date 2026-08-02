<?php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Enums\DispatchStatus;
use App\Enums\Logistics\CarrierShipmentStatus;
use App\Enums\StopStatus;
use App\Models\Dispatch;
use App\Models\Stop;
use App\Models\Tenant;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DispatchTest extends TestCase
{
    use RefreshDatabase;

    private TenantManager $tenantManager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenantManager = app(TenantManager::class);

        // Resolve a tenant context so BelongsToTenant global scope works
        $tenant = Tenant::factory()->create();
        $this->tenantManager->setTenantId($tenant->id);
    }

    protected function tearDown(): void
    {
        $this->tenantManager->clear();

        parent::tearDown();
    }

    #[Test]
    public function it_casts_date_attributes_to_immutable_datetimes(): void
    {
        $dispatch = Dispatch::factory()->create([
            'scheduled_at' => '2026-07-26 10:00:00',
            'departed_at' => '2026-07-26 11:00:00',
            'completed_at' => '2026-07-26 12:00:00',
        ]);

        $this->assertInstanceOf(CarbonImmutable::class, $dispatch->scheduled_at);
        $this->assertInstanceOf(CarbonImmutable::class, $dispatch->departed_at);
        $this->assertInstanceOf(CarbonImmutable::class, $dispatch->completed_at);
    }

    #[Test]
    public function it_mutates_status_using_enums_and_strings(): void
    {
        $dispatch = new Dispatch();

        // Test BackedEnum Assignment
        $enumValue = DispatchStatus::cases()[0];
        $dispatch->status = $enumValue;
        $this->assertEquals($enumValue->value, $dispatch->getAttributes()['status']);

        // Test String Assignment
        $dispatch->status = 'custom_carrier_string';
        $this->assertEquals('custom_carrier_string', $dispatch->getAttributes()['status']);
    }

    #[Test]
    public function it_accesses_and_resolves_status_types_correctly(): void
    {
        $dispatch = new Dispatch();

        // 1. Null handling
        $dispatch->setRawAttributes(['status' => null]);
        $this->assertNull($dispatch->status);

        // 2. DispatchStatus Enum resolution
        $dispatchEnum = DispatchStatus::cases()[0];
        $dispatch->setRawAttributes(['status' => $dispatchEnum->value]);
        $this->assertEquals($dispatchEnum, $dispatch->status);

        // 3. CarrierShipmentStatus Enum resolution
        // Bypassing DispatchStatus to ensure the fallback lookup works
        $carrierEnum = CarrierShipmentStatus::cases()[0];
        $dispatch->setRawAttributes(['status' => $carrierEnum->value]);

        // Note: If values overlap between Enums, it will return the first match (DispatchStatus). 
        // Assuming unique values across these domain enums for the test.
        if (!DispatchStatus::tryFrom($carrierEnum->value)) {
            $this->assertEquals($carrierEnum, $dispatch->status);
        }

        // 4. String fallback
        $dispatch->setRawAttributes(['status' => 'unrecognized_legacy_status']);
        $this->assertEquals('unrecognized_legacy_status', $dispatch->status);
    }

    #[Test]
    public function it_assigns_a_default_warehouse_when_creating_without_one(): void
    {
        $tenant = Tenant::factory()->create();
        $warehouse = Warehouse::factory()->create(['tenant_id' => $tenant->id]);

        $this->tenantManager->setTenantId($tenant->id);

        $dispatch = Dispatch::create([
            'reference_code' => 'DSP-DEFAULT-WH',
            'status' => DispatchStatus::Planned->value,
        ]);

        $this->assertSame($tenant->id, $dispatch->tenant_id);
        $this->assertSame($warehouse->id, $dispatch->warehouse_id);
    }

    #[Test]
    public function it_defines_warehouse_relationship(): void
    {
        $dispatch = Dispatch::factory()->create();

        $this->assertInstanceOf(Warehouse::class, $dispatch->warehouse);
    }

    #[Test]
    public function it_defines_stops_relationship_ordered_by_sequence(): void
    {
        $dispatch = Dispatch::factory()->create();

        Stop::factory()->create(['dispatch_id' => $dispatch->id, 'sequence' => 2]);
        Stop::factory()->create(['dispatch_id' => $dispatch->id, 'sequence' => 1]);

        $stops = $dispatch->stops;

        $this->assertCount(2, $stops);
        $this->assertEquals(1, $stops->first()->sequence);
        $this->assertEquals(2, $stops->last()->sequence);
    }

    #[Test]
    public function it_computes_current_stop_by_excluding_completed_and_failed(): void
    {
        $dispatch = Dispatch::factory()->create();

        // A completed stop that occurred earlier
        Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'sequence' => 1,
            'status' => StopStatus::Completed, // Assuming this case exists
        ]);

        // The expected active stop
        $activeStop = Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'sequence' => 2,
            'status' => StopStatus::Pending, // Assuming this case exists
        ]);

        // A future stop
        Stop::factory()->create([
            'dispatch_id' => $dispatch->id,
            'sequence' => 3,
            'status' => StopStatus::Pending,
        ]);

        $currentStop = $dispatch->current_stop;

        $this->assertNotNull($currentStop);
        $this->assertTrue($currentStop->is($activeStop));
    }

    #[Test]
    public function it_formats_driver_attribute_as_an_object(): void
    {
        $dispatch = new Dispatch();
        $dispatch->id = 789;
        $dispatch->driver_name = 'Marcus Pierce';

        $driver = $dispatch->driver;

        $this->assertIsObject($driver);
        $this->assertEquals(789, $driver->id);
        $this->assertEquals('Marcus Pierce', $driver->name);
    }

    #[Test]
    public function it_returns_null_for_driver_attribute_when_name_is_missing(): void
    {
        $dispatch = new Dispatch();
        $dispatch->driver_name = null;

        $this->assertNull($dispatch->driver);
    }
}
