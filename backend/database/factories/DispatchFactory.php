<?php

namespace Database\Factories;

use App\Enums\DispatchStatus;
use App\Models\Dispatch;
use App\Models\Tenant;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Dispatch> */
class DispatchFactory extends Factory
{
    protected $model = Dispatch::class;

    public function definition(): array
    {
        $tenantManager = app(TenantManager::class);
        $tenantId = $tenantManager->check()
            ? $tenantManager->id
            : Tenant::factory();

        return [
            'tenant_id' => $tenantId,
            'warehouse_id' => function (array $attributes) use ($tenantManager) {
                $warehouseTenantId = $tenantManager->check()
                    ? $tenantManager->id
                    : $attributes['tenant_id'];

                $tenantIdValue = $warehouseTenantId instanceof Tenant
                    ? $warehouseTenantId->id
                    : (is_object($warehouseTenantId) ? $warehouseTenantId->id : $warehouseTenantId);

                // Reuse an existing warehouse for this tenant to avoid unique code collisions
                // when bulk-creating dispatches.
                $warehouse = Warehouse::withoutTenancy()
                    ->where('tenant_id', $tenantIdValue)
                    ->first();

                if ($warehouse === null) {
                    $warehouse = Warehouse::factory()->create([
                        'tenant_id' => $tenantIdValue,
                    ]);
                }

                return $warehouse->id;
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
