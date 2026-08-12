<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\DriverStatus;
use App\Models\Driver;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Driver>
 */
final class DriverFactory extends Factory
{
    protected $model = Driver::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'user_id' => User::factory(),
            'license_number' => 'DL-' . $this->faker->unique()->bothify('####-####'),
            'phone_number' => $this->faker->phoneNumber(),
            'status' => DriverStatus::Active,
        ];
    }
}
