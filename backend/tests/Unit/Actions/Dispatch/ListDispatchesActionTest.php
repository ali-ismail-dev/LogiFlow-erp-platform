<?php

declare(strict_types=1);

namespace Tests\Unit\Actions\Dispatch;

use App\Actions\Dispatch\ListDispatchesAction;
use App\Models\Dispatch;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ListDispatchesActionTest extends TestCase
{
    use RefreshDatabase;

    private ListDispatchesAction $action;
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        app(TenantManager::class)->resolve($this->tenant);

        $this->action = new ListDispatchesAction();
    }

    protected function tearDown(): void
    {
        app(TenantManager::class)->forget();

        parent::tearDown();
    }

    #[Test]
    public function it_lists_all_dispatches_with_default_pagination(): void
    {
        Dispatch::factory()->count(20)->create(['tenant_id' => $this->tenant->id]);

        $result = ($this->action)([]);

        $this->assertCount(15, $result->items());
        $this->assertEquals(20, $result->total());
        $this->assertEquals(15, $result->perPage());
    }

    #[Test]
    public function it_filters_dispatches_by_status(): void
    {
        Dispatch::factory()->create(['tenant_id' => $this->tenant->id, 'status' => 'pending']);
        Dispatch::factory()->create(['tenant_id' => $this->tenant->id, 'status' => 'in_transit']);

        $result = ($this->action)(['status' => 'in_transit']);

        $this->assertCount(1, $result->items());

        // FIXED: Safe polymorphic enum text extraction matching File 10 accessors
        $statusValue = $result->items()[0]->status instanceof \BackedEnum
            ? $result->items()[0]->status->value
            : $result->items()[0]->status;

        $this->assertEquals('in_transit', $statusValue);
    }

    #[Test]
    public function it_filters_dispatches_by_reference_code(): void
    {
        Dispatch::factory()->create(['tenant_id' => $this->tenant->id, 'reference_code' => 'REF-ABC-123']);
        Dispatch::factory()->create(['tenant_id' => $this->tenant->id, 'reference_code' => 'REF-XYZ-999']);

        $result = ($this->action)(['reference_code' => 'ABC']);

        $this->assertCount(1, $result->items());
        $this->assertEquals('REF-ABC-123', $result->items()[0]->reference_code);
    }

    #[Test]
    public function it_filters_dispatches_by_driver_name(): void
    {
        Dispatch::factory()->create(['tenant_id' => $this->tenant->id, 'driver_name' => 'John Doe']);
        Dispatch::factory()->create(['tenant_id' => $this->tenant->id, 'driver_name' => 'Jane Smith']);

        $result = ($this->action)(['driver_name' => 'John']);

        $this->assertCount(1, $result->items());
        $this->assertEquals('John Doe', $result->items()[0]->driver_name);
    }

    #[Test]
    public function it_respects_custom_per_page_pagination(): void
    {
        Dispatch::factory()->count(10)->create(['tenant_id' => $this->tenant->id]);

        $result = ($this->action)(['per_page' => 5]);

        $this->assertCount(5, $result->items());
        $this->assertEquals(5, $result->perPage());
    }
}
