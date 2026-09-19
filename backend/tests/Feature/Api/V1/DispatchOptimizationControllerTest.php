<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class DispatchOptimizationControllerTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_recommends_a_vehicle_for_orders_in_the_current_tenant(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Dispatcher,
        ]);

        $orders = Order::factory()->count(2)->create([
            'tenant_id' => $tenant->id,
            'status' => OrderStatus::Pending,
            'total_weight_kg' => 250,
        ]);

        Vehicle::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Sprinter Van',
            'license_plate' => 'SPR-101',
            'max_weight_capacity_kg' => 1200,
            'is_active' => true,
        ]);

        $response = $this->actingAs($user)
            ->withHeader('X-Tenant-ID', $tenant->slug)
            ->postJson('/api/v1/dispatches/optimize/recommend-vehicle', [
                'order_ids' => $orders->pluck('id')->all(),
                'preferred_vehicle_type' => 'Sprinter',
                'window_minutes' => 90,
            ]);

        $response->assertOk();
        $response->assertJsonPath('data.total_weight_kg', 500);
        $response->assertJsonPath('data.recommendations.0.vehicle_identifier', 'SPR-101');
    }

    #[Test]
    public function it_suggests_split_batches_for_orders_in_the_current_tenant(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Dispatcher,
        ]);

        $orders = Order::factory()->count(3)->create([
            'tenant_id' => $tenant->id,
            'status' => OrderStatus::Pending,
            'total_weight_kg' => 600,
        ]);

        Vehicle::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Box Truck',
            'license_plate' => 'BOX-999',
            'max_weight_capacity_kg' => 1800,
            'is_active' => true,
        ]);

        $response = $this->actingAs($user)
            ->withHeader('X-Tenant-ID', $tenant->slug)
            ->postJson('/api/v1/dispatches/optimize/suggest-split', [
                'order_ids' => $orders->pluck('id')->all(),
                'target_vehicle_identifier' => 'BOX-999',
            ]);

        $response->assertOk();
        $response->assertJsonPath('data.total_weight_kg', 1800);
        $response->assertJsonPath('data.can_fit_single_vehicle', true);
        $response->assertJsonCount(1, 'data.suggested_batches');
    }

    #[Test]
    public function it_rejects_invalid_payloads_with_a_validation_error(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Dispatcher,
        ]);

        $response = $this->actingAs($user)
            ->withHeader('X-Tenant-ID', $tenant->slug)
            ->postJson('/api/v1/dispatches/optimize/recommend-vehicle', [
                'order_ids' => [],
                'window_minutes' => 0,
            ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['order_ids', 'window_minutes']);
    }
}
