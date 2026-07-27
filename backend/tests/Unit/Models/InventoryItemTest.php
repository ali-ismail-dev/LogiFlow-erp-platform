<?php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\InventoryItem;
use App\Models\Warehouse;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase; // FIXED: Modern transactional trait
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class InventoryItemTest extends TestCase
{
    use RefreshDatabase; // FIXED: Replaces DatabaseMigrations to avoid disk I/O drag

    private TenantManager $tenantManager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantManager = app(TenantManager::class);
    }

    protected function tearDown(): void
    {
        // FIXED: Clear active container singleton states to prevent memory leaks
        $this->tenantManager->clear();
        parent::tearDown();
    }

    #[Test]
    public function it_belongs_to_warehouse(): void
    {
        $tenant = Tenant::create(['name' => 'Test Tenant', 'slug' => 'test-tenant']);
        $this->tenantManager->setTenantId($tenant->id);

        $warehouse = Warehouse::create([
            'tenant_id' => $tenant->id,
            'name' => 'Main Warehouse',
            'code' => 'MW1',
            'timezone' => 'UTC',
            'address' => ['line1' => '123 Main St'],
            'is_active' => true,
        ]);

        $item = InventoryItem::create([
            'warehouse_id' => $warehouse->id,
            'sku' => 'SKU-001',
            'name' => 'Test Item',
            'quantity_on_hand' => 100,
            'quantity_reserved' => 10,
            'status' => 'active',
            'unit_weight_kg' => 1.5,
        ]);

        $this->assertTrue($item->warehouse->is($warehouse));
        $this->assertSame(100, $item->quantity_on_hand);
        $this->assertSame(10, $item->quantity_reserved);
    }
}
