<?php

namespace Database\Factories;

use App\Enums\DispatchStatus;
use App\Models\Dispatch;
use App\Models\Tenant;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Dispatch>
 */
class DispatchFactory extends Factory
{
    protected $model = Dispatch::class;

    public function definition(): array
    {
        // Elite Pattern: Define clean relationship generation nodes without 
        // mutating the active request TenantManager container context midway.
        return [
            'tenant_id' => Tenant::factory(),
            'warehouse_id' => function (array $attributes) {
                return Warehouse::factory()->create([
                    'tenant_id' => $attributes['tenant_id'],
                ])->id;
            },
            'reference_code' => fn() => 'REF-' . $this->faker->unique()->bothify('###-####'),
            'driver_name' => $this->faker->name(),
            'vehicle_identifier' => $this->faker->bothify('VEH-###'),
            'status' => DispatchStatus::Planned->value,
            'carrier_waybill_reference' => fn() => 'WB-' . $this->faker->unique()->bothify('###-####'),
            'scheduled_at' => now()->subHour(),
        ];
    }
}
