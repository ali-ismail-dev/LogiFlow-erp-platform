<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\OrderStatus;
use App\Models\Dispatch;
use App\Models\Driver;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DispatchControllerTest extends TestCase
{
    use RefreshDatabase;

    private TenantManager $tenantManager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenantManager = app(TenantManager::class);
    }

    protected function tearDown(): void
    {
        $this->tenantManager->clear();

        parent::tearDown();
    }

    #[Test]
    public function it_creates_a_bulk_manifest_for_orders_in_the_current_tenant(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Acme Fleet',
            'slug' => 'acme-fleet',
        ]);
        $this->tenantManager->setTenantId($tenant->id);

        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
        ]);

        $driver = Driver::factory()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
        ]);

        $vehicle = Vehicle::factory()->create([
            'tenant_id' => $tenant->id,
            'license_plate' => 'TRK-100',
        ]);

        $warehouse = Warehouse::factory()->create([
            'tenant_id' => $tenant->id,
        ]);

        $firstOrder = Order::factory()->create([
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
            'status' => OrderStatus::Pending->value,
        ]);

        $secondOrder = Order::factory()->create([
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
            'status' => OrderStatus::Processing->value,
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/dispatches', [
            'order_ids' => [$firstOrder->id, $secondOrder->id],
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
        ]);

        $response->assertStatus(201);

        $dispatch = Dispatch::query()->firstOrFail();

        $this->assertDatabaseHas('dispatches', [
            'id' => $dispatch->id,
            'tenant_id' => $tenant->id,
            'driver_name' => $driver->user->name,
            'vehicle_identifier' => $vehicle->license_plate,
        ]);

        $this->assertDatabaseHas('orders', [
            'id' => $firstOrder->id,
            'dispatch_id' => $dispatch->id,
            'status' => OrderStatus::Dispatched->value,
        ]);

        $this->assertDatabaseHas('orders', [
            'id' => $secondOrder->id,
            'dispatch_id' => $dispatch->id,
            'status' => OrderStatus::Dispatched->value,
        ]);
    }
}
