<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Order> */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        $tenantManager = app(TenantManager::class);

        return [
            'tenant_id' => $tenantManager->check()
                ? $tenantManager->id
                : Tenant::factory(),
            'warehouse_id' => fn(array $attributes) => Warehouse::factory()->create([
                'tenant_id' => $attributes['tenant_id'],
            ])->id,
            'order_number' => fn() => 'ORD-' . $this->faker->unique()->bothify('####'),
            'customer_name' => $this->faker->name(),
            'shipping_address' => [
                'line1' => $this->faker->streetAddress(),
                'city' => $this->faker->city(),
            ],
            'status' => OrderStatus::Pending->value,
            'total_weight_kg' => $this->faker->randomFloat(2, 10, 500),
        ];
    }
}
