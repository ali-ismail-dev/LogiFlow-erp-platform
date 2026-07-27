<?php

namespace Database\Factories;

use App\Enums\StopStatus;
use App\Models\Dispatch;
use App\Models\Order;
use App\Models\Stop;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Stop> */
class StopFactory extends Factory
{
    protected $model = Stop::class;

    public function definition(): array
    {
        $tenantManager = app(TenantManager::class);

        return [
            // 1. Resolve a single, unified tenant context point of truth
            'tenant_id' => $tenantManager->check()
                ? $tenantManager->id
                : Tenant::factory(),

            // 2. Cascade that exact resolved tenant_id down into child factories lazily
            'dispatch_id' => function (array $attributes) {
                return Dispatch::factory()->create([
                    'tenant_id' => $attributes['tenant_id'],
                ])->id;
            },

            'order_id' => function (array $attributes) {
                // Ensure the order belongs to the same tenant context boundary
                return Order::factory()->create([
                    'tenant_id' => $attributes['tenant_id'],
                ])->id;
            },

            'sequence' => $this->faker->numberBetween(1, 10),
            'destination_address' => [
                'line1' => $this->faker->streetAddress(),
                'city' => $this->faker->city(),
            ],
            'status' => StopStatus::Pending->value,
            'eta' => now()->addHour(),
        ];
    }
}
