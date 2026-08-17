<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\DispatchStatus;
use App\Enums\OrderStatus;
use App\Enums\StopStatus;
use App\Events\DispatchMovementUpdated;
use App\Models\Dispatch;
use App\Models\Driver;
use App\Models\Order;
use App\Models\Stop;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
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

        $this->assertDatabaseHas('stops', [
            'dispatch_id' => $dispatch->id,
            'order_id' => $firstOrder->id,
            'sequence' => 1,
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('stops', [
            'dispatch_id' => $dispatch->id,
            'order_id' => $secondOrder->id,
            'sequence' => 2,
            'status' => 'pending',
        ]);
    }

    #[Test]
    public function it_allows_creating_a_planned_manifest_without_driver_or_vehicle_assignment(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Acme Fleet',
            'slug' => 'acme-fleet',
        ]);
        $this->tenantManager->setTenantId($tenant->id);

        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
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
        ]);

        $response->assertStatus(201);

        $dispatch = Dispatch::query()->firstOrFail();

        $this->assertDatabaseHas('dispatches', [
            'id' => $dispatch->id,
            'tenant_id' => $tenant->id,
            'driver_name' => null,
            'vehicle_identifier' => null,
            'status' => DispatchStatus::Planned->value,
        ]);

        $this->assertDatabaseHas('orders', [
            'id' => $firstOrder->id,
            'dispatch_id' => $dispatch->id,
            'status' => OrderStatus::Dispatched->value,
        ]);
    }

    #[Test]
    public function it_assigns_a_driver_and_vehicle_to_an_existing_planned_manifest(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Northwind Logistics',
            'slug' => 'northwind-logistics',
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
            'license_plate' => 'TRK-900',
        ]);

        $warehouse = Warehouse::factory()->create([
            'tenant_id' => $tenant->id,
        ]);

        $dispatch = Dispatch::factory()->create([
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
            'driver_name' => null,
            'vehicle_identifier' => null,
            'status' => DispatchStatus::Planned->value,
        ]);

        Order::factory()->create([
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
            'dispatch_id' => $dispatch->id,
            'status' => OrderStatus::Dispatched->value,
        ]);

        Event::fake();

        $response = $this->actingAs($user, 'sanctum')->putJson(
            "/api/v1/dispatches/{$dispatch->id}/assign",
            [
                'driver_id' => $driver->id,
                'vehicle_id' => $vehicle->id,
            ]
        );

        $response->assertStatus(200);

        $this->assertDatabaseHas('dispatches', [
            'id' => $dispatch->id,
            'driver_name' => $user->name,
            'vehicle_identifier' => $vehicle->license_plate,
        ]);

        Event::assertDispatched(DispatchMovementUpdated::class, function (DispatchMovementUpdated $event) use ($dispatch): bool {
            return $event->dispatch->id === $dispatch->id;
        });
    }

    #[Test]
    public function it_marks_related_orders_and_stops_as_completed_when_a_dispatch_finishes(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Northwind Logistics',
            'slug' => 'northwind-logistics',
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
            'license_plate' => 'TRK-900',
        ]);

        $warehouse = Warehouse::factory()->create([
            'tenant_id' => $tenant->id,
        ]);

        $dispatch = Dispatch::factory()->create([
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
            'driver_name' => $user->name,
            'vehicle_identifier' => $vehicle->license_plate,
            'status' => DispatchStatus::InTransit->value,
        ]);

        $firstOrder = Order::factory()->create([
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
            'dispatch_id' => $dispatch->id,
            'status' => OrderStatus::Dispatched->value,
        ]);

        $secondOrder = Order::factory()->create([
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
            'dispatch_id' => $dispatch->id,
            'status' => OrderStatus::Dispatched->value,
        ]);

        Stop::factory()->create([
            'tenant_id' => $tenant->id,
            'dispatch_id' => $dispatch->id,
            'order_id' => $firstOrder->id,
            'sequence' => 1,
            'status' => StopStatus::Pending->value,
        ]);

        Stop::factory()->create([
            'tenant_id' => $tenant->id,
            'dispatch_id' => $dispatch->id,
            'order_id' => $secondOrder->id,
            'sequence' => 2,
            'status' => StopStatus::Pending->value,
        ]);

        $response = $this->actingAs($user, 'sanctum')->patchJson(
            "/api/v1/dispatches/{$dispatch->id}/status",
            ['status' => 'completed']
        );

        $response->assertStatus(200);
        $this->assertDatabaseHas('dispatches', [
            'id' => $dispatch->id,
            'status' => 'completed',
        ]);
        $this->assertDatabaseHas('orders', [
            'id' => $firstOrder->id,
            'status' => OrderStatus::Delivered->value,
        ]);
        $this->assertDatabaseHas('orders', [
            'id' => $secondOrder->id,
            'status' => OrderStatus::Delivered->value,
        ]);
        $this->assertDatabaseHas('stops', [
            'dispatch_id' => $dispatch->id,
            'order_id' => $firstOrder->id,
            'status' => StopStatus::Completed->value,
        ]);
        $this->assertDatabaseHas('stops', [
            'dispatch_id' => $dispatch->id,
            'order_id' => $secondOrder->id,
            'status' => StopStatus::Completed->value,
        ]);
    }
}
