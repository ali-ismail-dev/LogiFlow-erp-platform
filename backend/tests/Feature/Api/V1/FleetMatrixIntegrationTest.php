<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\DriverStatus;
use App\Enums\UserRole;
use App\Models\Driver;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class FleetMatrixIntegrationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function test_authenticated_user_can_list_vehicles_scoped_to_tenant(): void
    {
        $nike = Tenant::factory()->create([
            'name' => 'Nike Logistics',
            'slug' => 'nike',
            'is_active' => true,
        ]);

        $adidas = Tenant::factory()->create([
            'name' => 'Adidas Logistics',
            'slug' => 'adidas',
            'is_active' => true,
        ]);

        $nikeUser = User::factory()->create([
            'tenant_id' => $nike->id,
            'role' => UserRole::SuperAdmin,
        ]);

        $adidasUser = User::factory()->create([
            'tenant_id' => $adidas->id,
            'role' => UserRole::SuperAdmin,
        ]);

        $vehicle = Vehicle::create([
            'tenant_id' => $nike->id,
            'name' => 'Nike Cargo Van',
            'license_plate' => 'NKE-111',
            'max_weight_capacity_kg' => 1200,
            'is_active' => true,
        ]);

        $response = $this->actingAs($nikeUser)
            ->getJson('/api/v1/vehicles', ['X-Tenant-ID' => 'nike']);

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonStructure([
            'data' => [[
                'id',
                'tenant_id',
                'name',
                'license_plate',
                'max_weight_capacity_kg',
                'is_active',
            ]],
        ]);
        $response->assertJsonPath('data.0.id', $vehicle->id);
        $response->assertJsonPath('data.0.tenant_id', $nike->id);
        $response->assertJsonPath('data.0.name', 'Nike Cargo Van');
        $response->assertJsonPath('data.0.license_plate', 'NKE-111');
        $response->assertJsonPath('data.0.is_active', true);

        $crossTenantResponse = $this->actingAs($adidasUser)
            ->getJson('/api/v1/vehicles', ['X-Tenant-ID' => 'adidas']);

        $crossTenantResponse->assertOk();
        $crossTenantResponse->assertJsonCount(0, 'data');
    }

    #[Test]
    public function test_authorized_user_can_register_vehicle_under_active_tenant(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Nike Logistics',
            'slug' => 'nike',
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::SuperAdmin,
        ]);

        $payload = [
            'name' => 'Nike Freight Truck',
            'license_plate' => 'NKE-222',
            'max_weight_capacity_kg' => 2500,
        ];

        $response = $this->actingAs($user)
            ->postJson('/api/v1/vehicles', $payload, ['X-Tenant-ID' => 'nike']);

        $response->assertCreated();
        $response->assertJsonPath('data.tenant_id', $tenant->id);
        $response->assertJsonPath('data.name', 'Nike Freight Truck');
        $response->assertJsonPath('data.license_plate', 'NKE-222');

        $this->assertDatabaseHas('vehicles', [
            'tenant_id' => $tenant->id,
            'name' => 'Nike Freight Truck',
            'license_plate' => 'NKE-222',
            'max_weight_capacity_kg' => '2500.00',
        ]);
    }

    #[Test]
    public function test_authenticated_user_can_list_and_provision_drivers_with_metadata(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Nike Logistics',
            'slug' => 'nike',
            'is_active' => true,
        ]);

        $admin = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::SuperAdmin,
        ]);

        $userZoe = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Zoe Driver',
            'email' => 'zoe.driver@nike.com',
            'role' => UserRole::Driver,
        ]);

        $userAaron = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Aaron Driver',
            'email' => 'aaron.driver@nike.com',
            'role' => UserRole::Driver,
        ]);

        Driver::create([
            'tenant_id' => $tenant->id,
            'user_id' => $userZoe->id,
            'license_number' => 'ZE-111',
            'phone_number' => '+1-555-0111',
            'status' => DriverStatus::Active->value,
        ]);

        Driver::create([
            'tenant_id' => $tenant->id,
            'user_id' => $userAaron->id,
            'license_number' => 'AR-222',
            'phone_number' => '+1-555-0222',
            'status' => DriverStatus::Inactive->value,
        ]);

        $listResponse = $this->actingAs($admin)
            ->getJson('/api/v1/drivers', ['X-Tenant-ID' => 'nike']);

        $listResponse->assertOk();
        $listResponse->assertJsonCount(2, 'data');
        $listResponse->assertJsonPath('data.0.name', 'Aaron Driver');
        $listResponse->assertJsonPath('data.1.name', 'Zoe Driver');
        $listResponse->assertJsonPath('data.0.email', 'aaron.driver@nike.com');
        $listResponse->assertJsonPath('data.1.email', 'zoe.driver@nike.com');

        $provisionPayload = [
            'user_id' => $userZoe->id,
            'license_number' => 'NKE-999',
            'phone_number' => '+1-555-0999',
            'status' => DriverStatus::OnTrip->value,
        ];

        $createResponse = $this->actingAs($admin)
            ->postJson('/api/v1/drivers', $provisionPayload, ['X-Tenant-ID' => 'nike']);

        $createResponse->assertCreated();
        $createResponse->assertJsonPath('data.tenant_id', $tenant->id);
        $createResponse->assertJsonPath('data.user_id', $userZoe->id);
        $createResponse->assertJsonPath('data.license_number', 'NKE-999');
        $createResponse->assertJsonPath('data.phone_number', '+1-555-0999');
        $createResponse->assertJsonPath('data.status', DriverStatus::OnTrip->value);
        $createResponse->assertJsonPath('data.name', 'Zoe Driver');

        $this->assertDatabaseHas('drivers', [
            'tenant_id' => $tenant->id,
            'user_id' => $userZoe->id,
            'license_number' => 'NKE-999',
            'status' => DriverStatus::OnTrip->value,
        ]);
    }

    #[Test]
    public function test_authorized_user_can_register_order_under_active_tenant(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Nike Logistics',
            'slug' => 'nike',
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::SuperAdmin,
        ]);

        $warehouse = \App\Models\Warehouse::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Nike Central Hub',
            'code' => 'NKE-01',
            'address' => [
                'street' => '101 Main St',
                'city' => 'Portland',
                'state' => 'OR',
                'zip_code' => '97205',
            ],
            'is_active' => true,
        ]);

        $payload = [
            'warehouse_id' => $warehouse->id,
            'order_number' => 'NKE-ORD-1001',
            'customer_name' => 'Apex Retail Group',
            'total_weight_kg' => 245.50,
            'shipping_address' => [
                'street' => '600 Harbor Ave',
                'city' => 'Seattle',
            ],
            'status' => 'pending',
        ];

        $response = $this->actingAs($user)
            ->postJson('/api/v1/orders', $payload, ['X-Tenant-ID' => 'nike']);

        $response->assertCreated();
        $response->assertJsonPath('data.tenant_id', $tenant->id);
        $response->assertJsonPath('data.warehouse_id', $warehouse->id);
        $response->assertJsonPath('data.order_number', 'NKE-ORD-1001');
        $response->assertJsonPath('data.customer_name', 'Apex Retail Group');
        $response->assertJsonPath('data.status', 'pending');

        $this->assertDatabaseHas('orders', [
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
            'order_number' => 'NKE-ORD-1001',
            'customer_name' => 'Apex Retail Group',
            'status' => 'pending',
        ]);
    }
}
