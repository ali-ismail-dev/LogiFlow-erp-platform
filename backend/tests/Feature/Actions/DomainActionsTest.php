<?php

declare(strict_types=1);

namespace Tests\Feature\Actions;

use App\Actions\Logistics\OptimizeFleetDispatchAction;
use App\Actions\Dispatches\DispatchOrdersAction;
use App\DataTransferObjects\DispatchOrdersData;
use App\DataTransferObjects\StopData;
use App\Enums\OrderStatus;
use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Stop;
use App\Models\Tenant;
use App\Models\Vehicle;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DomainActionsTest extends TestCase
{
    use RefreshDatabase;

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
    public function it_creates_a_dispatch_and_stops_for_valid_orders(): void
    {
        $tenant = Tenant::create([
            'name' => 'Acme Logistics',
            'slug' => 'acme-logistics',
        ]);
        $this->tenantManager->setTenantId($tenant->id);

        $warehouse = Warehouse::create([
            'name' => 'Central Hub',
            'code' => 'CH1',
            'timezone' => 'UTC',
            'address' => ['line1' => '1 Main St'],
            'is_active' => true,
        ]);

        Vehicle::create([
            'name' => 'Truck 1',
            'license_plate' => 'ABC-123',
            'max_weight_capacity_kg' => 1500,
            'is_active' => true,
        ]);

        $firstOrder = Order::create([
            'warehouse_id' => $warehouse->id,
            'order_number' => 'ORD-1001',
            'customer_name' => 'Ada Lovelace',
            'shipping_address' => ['line1' => '10 First Ave'],
            'status' => OrderStatus::Pending->value,
            'total_weight_kg' => 600,
            'delivery_window_start' => now()->subHour(),
            'delivery_window_end' => now()->addHour(),
        ]);

        $secondOrder = Order::create([
            'warehouse_id' => $warehouse->id,
            'order_number' => 'ORD-1002',
            'customer_name' => 'Grace Hopper',
            'shipping_address' => ['line1' => '11 Second Ave'],
            'status' => OrderStatus::Processing->value,
            'total_weight_kg' => 400,
            'delivery_window_start' => now()->addMinutes(30),
            'delivery_window_end' => now()->addHours(2),
        ]);

        $dispatch = (new OptimizeFleetDispatchAction([$firstOrder->id, $secondOrder->id]))->handle();

        $this->assertInstanceOf(Dispatch::class, $dispatch);
        $this->assertDatabaseHas('dispatches', [
            'id' => $dispatch->id,
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
        ]);
        $this->assertSame(2, $dispatch->stops()->count());
        $this->assertSame(2, Stop::query()->where('dispatch_id', $dispatch->id)->count());
    }

    #[Test]
    public function it_rejects_payloads_that_exceed_vehicle_capacity(): void
    {
        $tenant = Tenant::create([
            'name' => 'Contoso',
            'slug' => 'contoso',
        ]);
        $this->tenantManager->setTenantId($tenant->id);

        $warehouse = Warehouse::create([
            'name' => 'South Hub',
            'code' => 'SH1',
            'timezone' => 'UTC',
            'address' => ['line1' => '2 Main St'],
            'is_active' => true,
        ]);

        Vehicle::create([
            'name' => 'Van 1',
            'license_plate' => 'XYZ-999',
            'max_weight_capacity_kg' => 1000,
            'is_active' => true,
        ]);

        $firstOrder = Order::create([
            'warehouse_id' => $warehouse->id,
            'order_number' => 'ORD-2001',
            'customer_name' => 'Linus Torvalds',
            'shipping_address' => ['line1' => '100 Linux Way'],
            'status' => OrderStatus::Pending->value,
            'total_weight_kg' => 600,
            'delivery_window_start' => now()->subHour(),
            'delivery_window_end' => now()->addHour(),
        ]);

        $secondOrder = Order::create([
            'warehouse_id' => $warehouse->id,
            'order_number' => 'ORD-2002',
            'customer_name' => 'Margaret Hamilton',
            'shipping_address' => ['line1' => '101 Code Ln'],
            'status' => OrderStatus::Processing->value,
            'total_weight_kg' => 600,
            'delivery_window_start' => now()->addMinutes(30),
            'delivery_window_end' => now()->addHours(2),
        ]);

        $this->expectException(ValidationException::class);

        (new OptimizeFleetDispatchAction([$firstOrder->id, $secondOrder->id]))->handle();
    }

    #[Test]
    public function it_creates_a_dispatch_and_marks_orders_dispatched(): void
    {
        $tenant = Tenant::create([
            'name' => 'Northwind',
            'slug' => 'northwind',
        ]);
        $this->tenantManager->setTenantId($tenant->id);

        $warehouse = Warehouse::create([
            'name' => 'Outbound Hub',
            'code' => 'OH1',
            'timezone' => 'UTC',
            'address' => ['line1' => '7 Harbor Rd'],
            'is_active' => true,
        ]);

        $order = Order::create([
            'warehouse_id' => $warehouse->id,
            'order_number' => 'ORD-3001',
            'customer_name' => 'Katherine Johnson',
            'shipping_address' => ['line1' => '7 Space Rd'],
            'status' => OrderStatus::Pending->value,
            'total_weight_kg' => 250,
        ]);

        $data = new DispatchOrdersData(
            warehouseId: $warehouse->id,
            referenceCode: 'REF-1001',
            driverName: 'Driver Diaz',
            vehicleIdentifier: 'TRK-77',
            scheduledAt: new DateTimeImmutable('2026-01-01 09:00:00'),
            stops: [new StopData($order->id, 1, ['line1' => '7 Space Rd'])],
        );

        $dispatch = (new DispatchOrdersAction())($data);

        $this->assertDatabaseHas('dispatches', [
            'id' => $dispatch->id,
            'tenant_id' => $tenant->id,
            'warehouse_id' => $warehouse->id,
            'reference_code' => 'REF-1001',
        ]);
        $this->assertDatabaseHas('stops', [
            'dispatch_id' => $dispatch->id,
            'order_id' => $order->id,
            'sequence' => 1,
        ]);
        $this->assertSame(OrderStatus::Dispatched->value, $order->fresh()->status->value);
    }

    #[Test]
    public function it_rejects_dispatches_without_any_stops(): void
    {
        $tenant = Tenant::create([
            'name' => 'Fabrikam',
            'slug' => 'fabrikam',
        ]);
        $this->tenantManager->setTenantId($tenant->id);

        $warehouse = Warehouse::create([
            'name' => 'West Hub',
            'code' => 'WH1',
            'timezone' => 'UTC',
            'address' => ['line1' => '3 River St'],
            'is_active' => true,
        ]);

        $data = new DispatchOrdersData(
            warehouseId: $warehouse->id,
            referenceCode: 'REF-1002',
            driverName: 'Driver Kim',
            vehicleIdentifier: 'TRK-88',
            scheduledAt: new DateTimeImmutable('2026-01-01 10:00:00'),
            stops: [],
        );

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('A dispatch requires at least one stop.');

        (new DispatchOrdersAction())($data);
    }
}
