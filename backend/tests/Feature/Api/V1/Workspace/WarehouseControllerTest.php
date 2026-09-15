<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1\Workspace;

use App\Enums\UserRole;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class WarehouseControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        app(TenantManager::class)->clear();

        parent::tearDown();
    }

    #[Test]
    public function an_inventory_manager_can_create_and_list_warehouses(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::SuperAdmin,
        ]);

        $this->actingAs($user)
            ->postJson('/api/v1/warehouses', [
                'name' => 'Central Hub',
                'code' => 'ch-1',
                'address' => '1 Main Street',
                'city' => 'Springfield',
            ], ['X-Tenant-ID' => 'acme'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Central Hub')
            ->assertJsonPath('data.code', 'CH-1')
            ->assertJsonPath('data.address.street', '1 Main Street')
            ->assertJsonPath('data.address.city', 'Springfield');

        $this->assertDatabaseHas('warehouses', [
            'tenant_id' => $tenant->id,
            'code' => 'CH-1',
            'is_active' => true,
        ]);

        $this->actingAs($user)
            ->getJson('/api/v1/warehouses', ['X-Tenant-ID' => 'acme'])
            ->assertOk()
            ->assertJsonPath('data.0.code', 'CH-1');
    }

    #[Test]
    public function warehouse_creation_validates_required_fields_and_tenant_scoped_codes(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::SuperAdmin,
        ]);

        app(TenantManager::class)->setTenantId($tenant->id);
        Warehouse::factory()->create([
            'tenant_id' => $tenant->id,
            'code' => 'DUPLICATE',
        ]);

        $this->actingAs($user)
            ->postJson('/api/v1/warehouses', [
                'name' => 'Duplicate Hub',
                'code' => 'DUPLICATE',
                'address' => '2 Main Street',
                'city' => 'Springfield',
            ], ['X-Tenant-ID' => 'acme'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    #[Test]
    public function a_user_without_inventory_permissions_cannot_create_a_warehouse(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Driver,
        ]);

        $this->actingAs($user)
            ->postJson('/api/v1/warehouses', [
                'name' => 'Central Hub',
                'code' => 'CH-1',
                'address' => '1 Main Street',
                'city' => 'Springfield',
            ], ['X-Tenant-ID' => 'acme'])
            ->assertForbidden();
    }
}
