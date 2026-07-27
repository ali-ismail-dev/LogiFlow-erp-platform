<?php

declare(strict_types=1);

namespace Tests\Unit\Actions\Dispatch;

use App\Actions\Dispatches\DispatchOrdersAction;
use App\DataTransferObjects\DispatchOrdersData;
use App\DataTransferObjects\StopData;
use App\Enums\DispatchStatus;
use App\Enums\OrderStatus;
use App\Enums\StopStatus;
use App\Exceptions\OrderNotDispatchableException;
use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DispatchOrdersActionTest extends TestCase
{
    use RefreshDatabase;

    private DispatchOrdersAction $action;
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        app(TenantManager::class)->resolve($this->tenant);
        $this->action = new DispatchOrdersAction();
    }

    protected function tearDown(): void
    {
        app(TenantManager::class)->forget();
        parent::tearDown();
    }

    #[Test]
    public function it_throws_exception_when_dispatching_with_no_stops(): void
    {
        $warehouse = Warehouse::factory()->create();

        $dto = new DispatchOrdersData(
            warehouseId: $warehouse->id,
            referenceCode: 'REF-001',
            driverName: 'John Doe',
            vehicleIdentifier: 'TRUCK-01',
            scheduledAt: CarbonImmutable::now(),
            stops: []
        );

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('A dispatch requires at least one stop.');

        ($this->action)($dto);
    }

    #[Test]
    public function it_throws_exception_when_stop_order_id_does_not_exist(): void
    {
        $warehouse = Warehouse::factory()->create();

        $dto = new DispatchOrdersData(
            warehouseId: $warehouse->id,
            referenceCode: 'REF-002',
            driverName: 'Jane Doe',
            vehicleIdentifier: 'TRUCK-02',
            scheduledAt: CarbonImmutable::now(),
            stops: [
                new StopData(
                    orderId: 99999, // Non-existent order
                    sequence: 1,
                    destinationAddress: ['street' => '123 Main St', 'city' => 'Metropolis']
                )
            ]
        );

        $this->expectException(OrderNotDispatchableException::class);

        ($this->action)($dto);
    }

    #[Test]
    public function it_throws_exception_when_order_is_not_dispatchable(): void
    {
        $warehouse = Warehouse::factory()->create();
        // Create an order with a status that is not dispatchable (e.g. Delivered or Cancelled)
        $order = Order::factory()->create([
            'tenant_id' => $warehouse->tenant_id,
            'warehouse_id' => $warehouse->id,
            'status' => OrderStatus::Delivered,
        ]);

        $dto = new DispatchOrdersData(
            warehouseId: $warehouse->id,
            referenceCode: 'REF-003',
            driverName: 'Driver X',
            vehicleIdentifier: 'TRUCK-03',
            scheduledAt: CarbonImmutable::now(),
            stops: [
                new StopData(
                    orderId: $order->id,
                    sequence: 1,
                    destinationAddress: ['street' => '456 Market St', 'city' => 'Metropolis']
                )
            ]
        );

        $this->expectException(OrderNotDispatchableException::class);

        ($this->action)($dto);
    }

    #[Test]
    public function it_successfully_creates_dispatch_and_updates_orders(): void
    {
        $warehouse = Warehouse::factory()->create();
        $order = Order::factory()->create([
            'tenant_id' => $warehouse->tenant_id,
            'warehouse_id' => $warehouse->id,
            'status' => OrderStatus::Pending, // Assumed dispatchable state
        ]);

        $scheduledAt = CarbonImmutable::now()->addHour();

        $dto = new DispatchOrdersData(
            warehouseId: $warehouse->id,
            referenceCode: 'REF-SUCCESS-01',
            driverName: 'Bob Vance',
            vehicleIdentifier: 'VANCE-1',
            scheduledAt: $scheduledAt,
            stops: [
                new StopData(
                    orderId: $order->id,
                    sequence: 1,
                    destinationAddress: ['street' => '789 Industrial Pkwy', 'city' => 'Scranton']
                )
            ]
        );

        $dispatch = ($this->action)($dto);

        $this->assertInstanceOf(Dispatch::class, $dispatch);
        $this->assertEquals('REF-SUCCESS-01', $dispatch->reference_code);
        $this->assertEquals('Bob Vance', $dispatch->driver_name);
        $this->assertEquals('VANCE-1', $dispatch->vehicle_identifier);
        $this->assertEquals(DispatchStatus::Planned, $dispatch->status);

        // Assert relationships are loaded
        $this->assertTrue($dispatch->relationLoaded('warehouse'));
        $this->assertTrue($dispatch->relationLoaded('stops'));

        // Assert Stop was created properly
        $stop = $dispatch->stops->first();
        $this->assertEquals($order->id, $stop->order_id);
        $this->assertEquals(1, $stop->sequence);
        $this->assertEquals(StopStatus::Pending, $stop->status);

        // Assert Order status was updated to Dispatched
        $this->assertEquals(OrderStatus::Dispatched, $order->fresh()->status);
    }
}
