<?php

declare(strict_types=1);

namespace Tests\Feature\Resources;

use App\Enums\OrderStatus;
use App\Http\Resources\OrderResource;
use App\Http\Resources\StopResource;
use App\Models\Order;
use App\Models\Stop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ResourceSerializationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_serializes_order_resources_with_the_expected_payload_contract(): void
    {
        $order = new Order();
        $order->forceFill([
            'id' => 42,
            'order_number' => 'ORD-9001',
            'customer_name' => 'Ada Lovelace',
            'shipping_address' => ['line1' => '10 Main St'],
            'status' => OrderStatus::Pending,
            'total_weight_kg' => '12.50',
        ]);

        $resource = new OrderResource($order);

        $this->assertSame([
            'id' => 42,
            'order_number' => 'ORD-9001',
            'customer_name' => 'Ada Lovelace',
            'shipping_address' => ['line1' => '10 Main St'],
            'status' => OrderStatus::Pending,
            'total_weight_kg' => '12.50',
        ], $resource->resolve());
    }

    #[Test]
    public function it_serializes_stop_resources_with_the_expected_payload_contract(): void
    {
        $order = new Order();
        $order->forceFill([
            'id' => 7,
            'order_number' => 'ORD-9002',
            'customer_name' => 'Grace Hopper',
            'shipping_address' => ['line1' => '22 Side St'],
            'status' => 'pending',
            'total_weight_kg' => '4.00',
        ]);

        $stop = new Stop();
        $stop->forceFill([
            'id' => 99,
            'sequence' => 1,
            'status' => 'pending',
            'destination_address' => ['line1' => '22 Side St'],
            'eta' => null,
            'arrived_at' => null,
            'completed_at' => null,
            'failure_reason' => null,
        ]);
        $stop->setRelation('order', $order);

        $resource = json_decode((new StopResource($stop))->toJson(), true);
        $this->assertSame([
            'id' => 99,
            'sequence' => 1,
            'status' => 'pending',
            'destination_address' => ['line1' => '22 Side St'],
            'eta' => null,
            'arrived_at' => null,
            'completed_at' => null,
            'failure_reason' => null,
            'order' => [
                'id' => 7,
                'order_number' => 'ORD-9002',
                'customer_name' => 'Grace Hopper',
                'shipping_address' => ['line1' => '22 Side St'],
                'status' => 'pending',
                'total_weight_kg' => '4.00',
            ],
        ], $resource);
    }
}
