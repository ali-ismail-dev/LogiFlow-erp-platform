<?php

declare(strict_types=1);

namespace Tests\Feature\Dispatch;

use App\Enums\DispatchStatus;
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

final class FeasibilityValidationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create(['slug' => 'feasibility-test']);
        app(TenantManager::class)->setTenantId($this->tenant->id);
        $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
        $this->warehouse = Warehouse::factory()->create(['tenant_id' => $this->tenant->id]);
    }

    #[Test]
    public function test_cannot_create_dispatch_exceeding_vehicle_capacity(): void
    {
        $vehicle = Vehicle::factory()->create([
            'tenant_id' => $this->tenant->id,
            'license_plate' => 'TRK-204',
            'max_weight_capacity_kg' => 1200,
        ]);
        $order = $this->order(1850);
        $driver = $this->driver('Capacity Driver');

        $response = $this->createDispatch($order, $vehicle, $driver);

        $response->assertStatus(422)
            ->assertJsonPath('errors.vehicle_identifier.0', 'Vehicle payload capacity exceeded.')
            ->assertJsonPath('message', 'Cannot assign vehicle TRK-204. This dispatch weighs 1,850 kg, but the vehicle capacity is 1,200 kg.');
        $this->assertDatabaseCount('dispatches', 0);
    }

    #[Test]
    public function test_cannot_assign_vehicle_currently_in_planned_or_in_transit_dispatch(): void
    {
        $vehicle = Vehicle::factory()->create(['tenant_id' => $this->tenant->id, 'license_plate' => 'TRK-205']);
        $driver = $this->driver('Vehicle Driver');
        $active = $this->dispatch('ACTIVE-VEHICLE', $vehicle->license_plate, 'Other Driver', DispatchStatus::Planned);
        $target = $this->dispatch('TARGET-VEHICLE', null, null);

        $response = $this->assign($target, $vehicle, $driver);

        $response->assertStatus(422)
            ->assertJsonPath('errors.vehicle_identifier.0', 'Vehicle is already assigned to an active dispatch.')
            ->assertJsonPath('message', "Vehicle TRK-205 is already assigned to active dispatch ACTIVE-VEHICLE (planned).");
        $this->assertDatabaseHas('dispatches', ['id' => $active->id, 'vehicle_identifier' => $vehicle->license_plate]);
    }

    #[Test]
    public function test_cannot_assign_driver_currently_in_planned_or_in_transit_dispatch(): void
    {
        $vehicle = Vehicle::factory()->create(['tenant_id' => $this->tenant->id, 'license_plate' => 'TRK-206']);
        $driver = $this->driver('Busy Driver');
        $this->dispatch('ACTIVE-DRIVER', null, $driver->user->name, DispatchStatus::InTransit);
        $target = $this->dispatch('TARGET-DRIVER', null, null);

        $response = $this->assign($target, $vehicle, $driver);

        $response->assertStatus(422)
            ->assertJsonPath('errors.driver_name.0', 'Driver is already assigned to an active dispatch.')
            ->assertJsonPath('message', "Driver {$driver->user->name} is already assigned to active dispatch ACTIVE-DRIVER (in_transit).");
    }

    #[Test]
    public function test_can_reassign_vehicle_and_driver_when_previous_dispatch_is_completed_or_cancelled(): void
    {
        $vehicle = Vehicle::factory()->create(['tenant_id' => $this->tenant->id, 'license_plate' => 'TRK-207']);
        $driver = $this->driver('Available Driver');
        $this->dispatch('COMPLETED', $vehicle->license_plate, $driver->user->name, DispatchStatus::Completed);
        $target = $this->dispatch('TARGET-AVAILABLE', null, null);

        $response = $this->assign($target, $vehicle, $driver);

        $response->assertOk();
        $this->assertDatabaseHas('dispatches', [
            'id' => $target->id,
            'vehicle_identifier' => $vehicle->license_plate,
            'driver_name' => $driver->user->name,
        ]);

        $cancelledVehicle = Vehicle::factory()->create([
            'tenant_id' => $this->tenant->id,
            'license_plate' => 'TRK-209',
        ]);
        $cancelledDriver = $this->driver('Cancelled Driver');
        $this->dispatch('CANCELLED', $cancelledVehicle->license_plate, $cancelledDriver->user->name, DispatchStatus::Cancelled);
        $cancelledTarget = $this->dispatch('TARGET-CANCELLED', null, null);

        $this->assign($cancelledTarget, $cancelledVehicle, $cancelledDriver)->assertOk();
    }

    #[Test]
    public function test_assign_fleet_action_correctly_validates_weight_and_availability(): void
    {
        $vehicle = Vehicle::factory()->create([
            'tenant_id' => $this->tenant->id,
            'license_plate' => 'TRK-208',
            'max_weight_capacity_kg' => 100,
        ]);
        $driver = $this->driver('Weight Driver');
        $target = $this->dispatch('TARGET-WEIGHT', null, null);
        $order = $this->order(101, $target->id);

        $response = $this->assign($target, $vehicle, $driver);

        $response->assertStatus(422)
            ->assertJsonPath('errors.vehicle_identifier.0', 'Vehicle payload capacity exceeded.');
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'total_weight_kg' => 101]);
        $this->assertDatabaseHas('dispatches', ['id' => $target->id, 'vehicle_identifier' => null]);
    }

    private function order(float $weight, ?int $dispatchId = null): Order
    {
        return Order::factory()->create([
            'tenant_id' => $this->tenant->id,
            'warehouse_id' => $this->warehouse->id,
            'dispatch_id' => $dispatchId,
            'status' => OrderStatus::Pending->value,
            'total_weight_kg' => $weight,
        ]);
    }

    private function driver(string $name): Driver
    {
        $user = User::factory()->create(['tenant_id' => $this->tenant->id, 'name' => $name]);

        return Driver::factory()->create(['tenant_id' => $this->tenant->id, 'user_id' => $user->id]);
    }

    private function dispatch(string $reference, ?string $vehicle, ?string $driver, DispatchStatus $status = DispatchStatus::Planned): Dispatch
    {
        return Dispatch::factory()->create([
            'tenant_id' => $this->tenant->id,
            'warehouse_id' => $this->warehouse->id,
            'reference_code' => $reference,
            'vehicle_identifier' => $vehicle,
            'driver_name' => $driver,
            'status' => $status->value,
        ]);
    }

    private function createDispatch(Order $order, Vehicle $vehicle, Driver $driver)
    {
        return $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/dispatches', [
            'order_ids' => [$order->id],
            'vehicle_id' => $vehicle->id,
            'driver_id' => $driver->id,
        ], ['X-Tenant-ID' => $this->tenant->slug]);
    }

    private function assign(Dispatch $dispatch, Vehicle $vehicle, Driver $driver)
    {
        return $this->actingAs($this->user, 'sanctum')->putJson(
            "/api/v1/dispatches/{$dispatch->id}/assign",
            ['vehicle_id' => $vehicle->id, 'driver_id' => $driver->id],
            ['X-Tenant-ID' => $this->tenant->slug],
        );
    }
}
