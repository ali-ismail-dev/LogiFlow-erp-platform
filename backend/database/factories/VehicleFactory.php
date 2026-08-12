<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Tenant;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehicle>
 */
class VehicleFactory extends Factory
{
    protected $model = Vehicle::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => $this->faker->randomElement([
                'Sprinter Van',
                'Delivery Truck',
                'Box Truck',
                'Cargo Van',
                'Heavy Duty Truck',
            ]),
            'license_plate' => strtoupper($this->faker->unique()->bothify('???-###')),
            'max_weight_capacity_kg' => $this->faker->randomFloat(2, 500, 20000),
            'is_active' => true,
        ];
    }
}
