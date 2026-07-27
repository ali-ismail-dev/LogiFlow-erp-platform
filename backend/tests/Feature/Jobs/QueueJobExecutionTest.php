<?php

declare(strict_types=1);

namespace Tests\Feature\Jobs;

use App\Enums\DispatchStatus;
use App\Jobs\ProcessAutomatedAccountingLedger;
use App\Models\Dispatch;
use App\Models\Tenant;
use App\Models\Warehouse;
use App\Services\Accounting\LedgerGenerator;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase; // FIXED: Harmonized testing trait
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

class QueueJobExecutionTest extends TestCase
{
    use RefreshDatabase; // FIXED: Using lightweight transactional rollbacks

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
    public function it_pushes_the_job_to_the_queue(): void
    {
        $job = new ProcessAutomatedAccountingLedger('tenant-999', 999);

        $this->assertSame('tenant-999', $job->tenantId);
        $this->assertSame(999, $job->dispatchTripId);
        $this->assertSame('accounting-ledger', $job->queue);
    }

    #[Test]
    public function it_marks_the_dispatch_trip_as_posted_when_the_job_handles(): void
    {
        $tenant = Tenant::create([
            'name' => 'Metro',
            'slug' => 'metro',
        ]);
        $this->tenantManager->setTenantId($tenant->id);

        $warehouse = Warehouse::create([
            'name' => 'Depot A',
            'code' => 'DA1',
            'timezone' => 'UTC',
            'address' => ['line1' => '42 Depot Rd'],
            'is_active' => true,
        ]);

        $dispatchTrip = Dispatch::create([
            'warehouse_id' => $warehouse->id,
            'reference_code' => 'DSP-POST',
            'driver_name' => 'Driver One',
            'vehicle_identifier' => 'TRK-44',
            'status' => DispatchStatus::Planned->value,
            'scheduled_at' => now(),
        ]);

        $job = new ProcessAutomatedAccountingLedger((string) $tenant->id, $dispatchTrip->id);

        $job->handle($this->tenantManager, new LedgerGenerator());

        $this->assertSame('posted', $dispatchTrip->fresh()->ledger_status);
    }

    #[Test]
    public function it_records_failed_jobs_in_the_dlq_columns(): void
    {
        $tenant = Tenant::create([
            'name' => 'Harbor',
            'slug' => 'harbor',
        ]);
        $this->tenantManager->setTenantId($tenant->id);

        $warehouse = Warehouse::create([
            'name' => 'Depot B',
            'code' => 'DB1',
            'timezone' => 'UTC',
            'address' => ['line1' => '44 Depot Rd'],
            'is_active' => true,
        ]);

        $dispatchTrip = Dispatch::create([
            'warehouse_id' => $warehouse->id,
            'reference_code' => 'DSP-FAIL',
            'driver_name' => 'Driver Two',
            'vehicle_identifier' => 'TRK-45',
            'status' => DispatchStatus::Planned->value,
            'scheduled_at' => now(),
        ]);

        $job = new ProcessAutomatedAccountingLedger((string) $tenant->id, $dispatchTrip->id);

        $job->failed(new RuntimeException('boom'));

        $dispatchTrip->refresh();

        $this->assertSame('exception', $dispatchTrip->ledger_status);
        $this->assertSame('boom', $dispatchTrip->ledger_error);
    }
}
