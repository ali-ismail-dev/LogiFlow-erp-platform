<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1\Workspace;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class WorkspaceTenantControllersTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_lists_orders_and_allows_creating_orders_for_the_active_tenant(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Dispatcher,
        ]);

        $warehouse = Warehouse::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Central Warehouse',
        ]);

        Order::factory()->create([
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
            'status' => OrderStatus::Pending,
            'order_number' => 'ORD-1001',
        ]);

        $listResponse = $this->actingAs($user)
            ->withHeader('X-Tenant-ID', $tenant->slug)
            ->getJson('/api/v1/orders');

        $listResponse->assertOk();
        $listResponse->assertJsonPath('meta.total', 1);

        $createResponse = $this->actingAs($user)
            ->withHeader('X-Tenant-ID', $tenant->slug)
            ->postJson('/api/v1/orders', [
                'warehouse_id' => $warehouse->id,
                'order_number' => 'ORD-1002',
                'customer_name' => 'Ava Patel',
                'total_weight_kg' => 145.5,
                'shipping_address' => [
                    'street' => '101 Market St',
                    'city' => 'Spokane',
                ],
                'status' => 'pending',
            ]);

        $createResponse->assertCreated();
        $createResponse->assertJsonPath('data.customer_name', 'Ava Patel');
        $this->assertDatabaseHas('orders', ['tenant_id' => $tenant->id, 'order_number' => 'ORD-1002']);
    }

    #[Test]
    public function it_lists_users_and_allows_tenant_admins_to_create_users(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $admin = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::SuperAdmin,
        ]);

        $existing = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Dispatcher,
        ]);

        $listResponse = $this->actingAs($admin)
            ->withHeader('X-Tenant-ID', $tenant->slug)
            ->getJson('/api/v1/users');

        $listResponse->assertOk();
        $listResponse->assertJsonPath('meta.total', 2);

        $createResponse = $this->actingAs($admin)
            ->withHeader('X-Tenant-ID', $tenant->slug)
            ->postJson('/api/v1/users', [
                'name' => 'Nia Worker',
                'email' => 'nia.worker+' . now()->timestamp . '@example.com',
                'role' => UserRole::Dispatcher->value,
            ]);

        $createResponse->assertCreated();
        $createResponse->assertJsonPath('data.name', 'Nia Worker');
        $this->assertDatabaseHas('users', ['tenant_id' => $tenant->id, 'email' => $createResponse->json('data.email')]);

        $dispatcher = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Dispatcher,
        ]);

        $this->actingAs($dispatcher)
            ->withHeader('X-Tenant-ID', $tenant->slug)
            ->postJson('/api/v1/users', [
                'name' => 'Blocked User',
                'email' => 'blocked@example.com',
                'role' => UserRole::Dispatcher->value,
            ])
            ->assertForbidden();
    }
}
