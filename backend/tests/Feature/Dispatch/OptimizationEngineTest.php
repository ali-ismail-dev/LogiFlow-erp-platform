<?php

declare(strict_types=1);

namespace Tests\Feature\Dispatch;

use App\Actions\Dispatch\RecommendVehicleAction;
use App\Actions\Dispatch\SuggestOrderSplitAction;
use App\Enums\DispatchStatus;
use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class OptimizationEngineTest extends TestCase
{
    use RefreshDatabase;

    public function test_recommends_vehicle_with_highest_safe_utilization(): void
    {
        $tenant = Tenant::factory()->create();
        $orders = Order::factory()->count(1)->create(['tenant_id' => $tenant->id, 'total_weight_kg' => 900]);
        Vehicle::factory()->create(['tenant_id' => $tenant->id, 'license_plate' => 'TRK-204', 'max_weight_capacity_kg' => 1000]);
        Vehicle::factory()->create(['tenant_id' => $tenant->id, 'license_plate' => 'VAN-108', 'max_weight_capacity_kg' => 2000]);

        $result = app(RecommendVehicleAction::class)->execute($tenant->id, $orders->pluck('id')->all());

        $this->assertSame('TRK-204', $result['recommendations'][0]['vehicle_identifier']);
        $this->assertTrue($result['recommendations'][0]['is_best_match']);
        $this->assertSame(90.0, $result['recommendations'][0]['utilization_percentage']);
    }

    public function test_suggests_optimal_bin_packing_split_when_overweight(): void
    {
        $tenant = Tenant::factory()->create();
        $orders = collect([700, 600, 500, 400])->map(fn(int $weight) => Order::factory()->create([
            'tenant_id' => $tenant->id,
            'total_weight_kg' => $weight,
        ]));
        Vehicle::factory()->create(['tenant_id' => $tenant->id, 'license_plate' => 'TRK-204', 'max_weight_capacity_kg' => 1300]);
        Vehicle::factory()->create(['tenant_id' => $tenant->id, 'license_plate' => 'VAN-108', 'max_weight_capacity_kg' => 1100]);

        $result = app(SuggestOrderSplitAction::class)->execute($tenant->id, $orders->pluck('id')->all());

        $this->assertFalse($result['can_fit_single_vehicle']);
        $this->assertSame(2200.0, $result['total_weight_kg']);
        $this->assertCount(2, $result['suggested_batches']);
        $this->assertSame(1300.0, $result['suggested_batches'][0]['batch_weight_kg']);
        $this->assertSame(900.0, $result['suggested_batches'][1]['batch_weight_kg']);
    }

    public function test_ignores_unavailable_vehicles_during_recommendation(): void
    {
        $tenant = Tenant::factory()->create();
        $order = Order::factory()->create(['tenant_id' => $tenant->id, 'total_weight_kg' => 800]);
        Vehicle::factory()->create(['tenant_id' => $tenant->id, 'license_plate' => 'BUSY-1', 'max_weight_capacity_kg' => 900]);
        Vehicle::factory()->create(['tenant_id' => $tenant->id, 'license_plate' => 'FREE-1', 'max_weight_capacity_kg' => 1200]);
        Dispatch::factory()->create([
            'tenant_id' => $tenant->id,
            'vehicle_identifier' => 'BUSY-1',
            'status' => DispatchStatus::Planned,
        ]);

        $result = app(RecommendVehicleAction::class)->execute($tenant->id, [$order->id]);

        $this->assertSame(['FREE-1'], array_column($result['recommendations'], 'vehicle_identifier'));
    }
}
