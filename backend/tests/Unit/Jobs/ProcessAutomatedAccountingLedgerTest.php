<?php

declare(strict_types=1);

namespace Tests\Unit\Jobs;

use App\Jobs\ProcessAutomatedAccountingLedger;
use App\Models\Dispatch;
use App\Models\Tenant;
use App\Services\Accounting\LedgerGenerator;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

class ProcessAutomatedAccountingLedgerTest extends TestCase
{
    use RefreshDatabase;

    private TenantManager $tenantManager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantManager = $this->app->make(TenantManager::class);
        $this->tenantManager->clear();
    }

    #[Test]
    public function it_returns_correct_unique_id_and_tags(): void
    {
        $job = new ProcessAutomatedAccountingLedger(tenantId: 'tenant_123', dispatchTripId: 456);

        $this->assertEquals('ledger:tenant_123:456', $job->uniqueId());
        $this->assertEquals([
            'ledger',
            'tenant:tenant_123',
            'trip:456',
        ], $job->tags());
    }

    #[Test]
    public function it_successfully_processes_accounting_ledger_and_clears_tenant_context(): void
    {
        $tenant = Tenant::factory()->create();
        $dispatch = Dispatch::factory()->create([
            'tenant_id' => $tenant->id,
            'ledger_status' => 'pending',
        ]);

        $ledgerGenerator = Mockery::mock(LedgerGenerator::class);
        $ledgerGenerator->shouldReceive('generateForTrip')
            ->once()
            ->with(Mockery::on(fn(Dispatch $arg) => $arg->id === $dispatch->id));

        $job = new ProcessAutomatedAccountingLedger(
            tenantId: (string) $tenant->id,
            dispatchTripId: $dispatch->id
        );

        $job->handle($this->tenantManager, $ledgerGenerator);

        $this->assertEquals('posted', $dispatch->fresh()->ledger_status);
        $this->assertFalse($this->tenantManager->check());
    }

    #[Test]
    public function it_clears_tenant_context_if_job_handle_throws_exception(): void
    {
        $tenant = Tenant::factory()->create();
        $dispatch = Dispatch::factory()->create([
            'tenant_id' => $tenant->id,
        ]);

        $ledgerGenerator = Mockery::mock(LedgerGenerator::class);
        $ledgerGenerator->shouldReceive('generateForTrip')
            ->once()
            ->andThrow(new RuntimeException('Ledger engine failed'));

        $job = new ProcessAutomatedAccountingLedger(
            tenantId: (string) $tenant->id,
            dispatchTripId: $dispatch->id
        );

        try {
            $job->handle($this->tenantManager, $ledgerGenerator);
        } catch (RuntimeException $e) {
            // Context cleanup test expectation
        }

        $this->assertFalse($this->tenantManager->check());
    }

    #[Test]
    public function it_handles_failed_hook_with_exception(): void
    {
        $tenant = Tenant::factory()->create();
        $dispatch = Dispatch::factory()->create([
            'tenant_id' => $tenant->id,
            'ledger_status' => 'pending',
        ]);

        $job = new ProcessAutomatedAccountingLedger(
            tenantId: (string) $tenant->id,
            dispatchTripId: $dispatch->id
        );

        $exception = new RuntimeException('Connection timeout to accounting API');

        $job->failed($exception);

        $freshDispatch = $dispatch->fresh();
        $this->assertEquals('exception', $freshDispatch->ledger_status);
        $this->assertEquals('Connection timeout to accounting API', $freshDispatch->ledger_error);
        $this->assertNotNull($freshDispatch->ledger_failed_at);

        $this->assertFalse($this->tenantManager->check());
    }

    #[Test]
    public function it_handles_failed_hook_with_null_exception(): void
    {
        $tenant = Tenant::factory()->create();
        $dispatch = Dispatch::factory()->create([
            'tenant_id' => $tenant->id,
            'ledger_status' => 'pending',
        ]);

        $job = new ProcessAutomatedAccountingLedger(
            tenantId: (string) $tenant->id,
            dispatchTripId: $dispatch->id
        );

        $job->failed(null);

        $freshDispatch = $dispatch->fresh();
        $this->assertEquals('exception', $freshDispatch->ledger_status);
        $this->assertEquals('Job failed with no exception instance.', $freshDispatch->ledger_error);

        $this->assertFalse($this->tenantManager->check());
    }
}
