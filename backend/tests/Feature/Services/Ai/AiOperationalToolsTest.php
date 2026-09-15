<?php

declare(strict_types=1);

namespace Tests\Feature\Services\Ai;

use App\Enums\DriverStatus;
use App\Models\Dispatch;
use App\Models\Driver;
use App\Models\Stop;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Ai\Tools\CompareDriverWorkloadsTool;
use App\Services\Ai\Tools\FindAtRiskStopsTool;
use App\Services\Ai\Tools\GetDispatchStatusTool;
use App\Services\Ai\Tools\GetTelemetrySummaryTool;
use App\Services\Ai\Tools\SummarizeOperationalEventsTool;
use App\Support\Tenancy\TenantManager;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class AiOperationalToolsTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        app(TenantManager::class)->clear();
        Carbon::setTestNow();

        parent::tearDown();
    }

    #[Test]
    public function dispatch_status_returns_progress_and_rejects_other_tenants(): void
    {
        $tenant = Tenant::factory()->create();
        $otherTenant = Tenant::factory()->create();
        $this->setTenant($tenant);
        $warehouse = Warehouse::factory()->create();
        $dispatch = Dispatch::factory()->create([
            'warehouse_id' => $warehouse->id,
            'reference_code' => 'DSP-1',
            'driver_name' => 'Alex Driver',
            'status' => 'in_transit',
        ]);
        Stop::factory()->create(['dispatch_id' => $dispatch->id, 'tenant_id' => $tenant->id, 'status' => 'completed']);
        Stop::factory()->create(['dispatch_id' => $dispatch->id, 'tenant_id' => $tenant->id, 'status' => 'pending']);
        $otherDispatch = Dispatch::factory()->create(['tenant_id' => $otherTenant->id, 'reference_code' => 'DSP-OTHER']);

        $tool = new GetDispatchStatusTool();
        $result = $tool->execute(['dispatch_id' => 'DSP-1'], $tenant->id);

        $this->assertSame(2, $result['total_stops']);
        $this->assertSame(1, $result['completed_stops']);
        $this->assertSame('Alex Driver', $result['driver']['name']);
        $this->assertSame(['error' => 'Dispatch not found or access denied'], $tool->execute(['dispatch_id' => $otherDispatch->id], $tenant->id));
        $this->assertSame(['error' => 'Dispatch not found or access denied'], $tool->execute(['dispatch_id' => ''], $tenant->id));
    }

    #[Test]
    public function telemetry_reports_active_drivers_and_supports_driver_filtering(): void
    {
        $tenant = Tenant::factory()->create();
        $this->setTenant($tenant);
        $first = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'First Driver']);
        $second = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Second Driver']);
        Driver::factory()->create(['tenant_id' => $tenant->id, 'user_id' => $first->id, 'status' => DriverStatus::Active]);
        Driver::factory()->create(['tenant_id' => $tenant->id, 'user_id' => $second->id, 'status' => DriverStatus::Inactive]);

        $all = (new GetTelemetrySummaryTool())->execute([], $tenant->id);
        $filtered = (new GetTelemetrySummaryTool())->execute(['driver_id' => (string) $all['drivers'][0]['driver_id']], $tenant->id);

        $this->assertSame('not_configured', $all['telemetry_source']);
        $this->assertCount(1, $all['drivers']);
        $this->assertSame('unavailable', $filtered['drivers'][0]['signal_status']);
    }

    #[Test]
    public function at_risk_stops_detect_overdue_and_delayed_dispatches(): void
    {
        Carbon::setTestNow('2026-09-15 12:00:00');
        $tenant = Tenant::factory()->create();
        $this->setTenant($tenant);
        $warehouse = Warehouse::factory()->create();
        $dispatch = Dispatch::factory()->create(['warehouse_id' => $warehouse->id, 'status' => 'delayed', 'reference_code' => 'DSP-RISK']);
        Stop::factory()->create(['dispatch_id' => $dispatch->id, 'tenant_id' => $tenant->id, 'eta' => now()->subMinutes(90)]);
        Stop::factory()->create(['dispatch_id' => $dispatch->id, 'tenant_id' => $tenant->id, 'eta' => now()->addHour()]);

        $result = (new FindAtRiskStopsTool())->execute(['severity' => 'high', 'warehouse_id' => $warehouse->id, 'limit' => 1], $tenant->id);

        $this->assertCount(1, $result);
        $this->assertSame('high', $result[0]['delay_minutes'] >= 60 ? 'high' : 'medium');
        $this->assertStringContainsString('delayed', $result[0]['reason']);
    }

    #[Test]
    public function driver_workloads_are_classified_and_empty_tenants_return_no_rows(): void
    {
        $tenant = Tenant::factory()->create();
        $this->setTenant($tenant);
        $user = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Work Driver']);
        Driver::factory()->create(['tenant_id' => $tenant->id, 'user_id' => $user->id, 'status' => DriverStatus::Active]);

        $result = (new CompareDriverWorkloadsTool())->execute(['limit' => '5'], $tenant->id);

        $this->assertCount(1, $result);
        $this->assertSame('balanced', $result[0]['workload_status']);
        $this->assertSame([], (new CompareDriverWorkloadsTool())->execute([], Tenant::factory()->create()->id));
    }

    #[Test]
    public function operational_events_summarize_recent_exceptions(): void
    {
        Carbon::setTestNow('2026-09-15 12:00:00');
        $tenant = Tenant::factory()->create();
        $this->setTenant($tenant);
        Dispatch::factory()->create(['tenant_id' => $tenant->id, 'status' => 'completed', 'updated_at' => now()->subHour()]);
        Dispatch::factory()->create(['tenant_id' => $tenant->id, 'status' => 'cancelled', 'updated_at' => now()->subHours(2)]);
        Dispatch::factory()->create(['tenant_id' => $tenant->id, 'status' => 'delivery_failed', 'updated_at' => now()->subHours(3)]);

        $result = (new SummarizeOperationalEventsTool())->execute(['hours' => '24'], $tenant->id);

        $this->assertSame(1, $result['completed_dispatches']);
        $this->assertSame(1, $result['cancelled_dispatches']);
        $this->assertCount(2, $result['exceptions']);
    }

    private function setTenant(Tenant $tenant): void
    {
        app(TenantManager::class)->resolve($tenant);
    }
}
