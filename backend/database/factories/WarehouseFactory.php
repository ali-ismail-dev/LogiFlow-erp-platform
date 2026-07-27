<?php

namespace Database\Factories;

use App\Models\Tenant;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Warehouse>
 */
class WarehouseFactory extends Factory
{
    protected $model = Warehouse::class;

    public function definition(): array
    {
        $tenantManager = app(TenantManager::class);

        return [
            'tenant_id' => $tenantManager->check()
                ? $tenantManager->id
                : Tenant::factory(),
            'name' => $this->faker->company() . ' Warehouse',
            'code' => strtoupper($this->faker->unique()->bothify('WH-#####')),
            'timezone' => 'UTC',
            'address' => ['street' => $this->faker->streetAddress(), 'city' => $this->faker->city()],
            'is_active' => true,
        ];
    }
}
