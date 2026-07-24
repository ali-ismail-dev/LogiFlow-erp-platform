<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Tenant;
use App\Enums\OrderStatus;
use App\Enums\DispatchStatus;
use App\Enums\StopStatus;
use Illuminate\Support\Facades\DB;

class LogiFlowDevSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            // 1. Create a Primary Business Tenant Context
            $tenant = Tenant::create([
                'name' => 'Nike Logistics',
                'slug' => 'nike',
                'is_active' => true,
                'settings' => ['region' => 'US-WEST']
            ]);

            // 2. Create an Operational Warehouse Storage Hub
            $warehouse = $tenant->warehouses()->create([
                'name' => 'North Bay Distribution',
                'code' => 'NBD-02',
                'timezone' => 'America/Los_Angeles',
                'address' => ['line1' => '100 Logistics Way', 'city' => 'Oakland', 'state' => 'CA'],
                'is_active' => true
            ]);

            // 3. Populate Customer Orders
            $order1 = $warehouse->orders()->create([
                'tenant_id' => $tenant->id,
                'order_number' => 'ORD-5501',
                'customer_name' => 'Callo & Vance LLP',
                'shipping_address' => ['line1' => '412 Harrow St', 'city' => 'Oakland', 'state' => 'CA'],
                'status' => OrderStatus::Dispatched,
                'total_weight_kg' => 18.4,
                'promised_at' => now()->addHours(4)
            ]);

            $order2 = $warehouse->orders()->create([
                'tenant_id' => $tenant->id,
                'order_number' => 'ORD-5502',
                'customer_name' => 'Nourish Market Co-op',
                'shipping_address' => ['line1' => '88 Telegraph Ave', 'city' => 'Berkeley', 'state' => 'CA'],
                'status' => OrderStatus::Dispatched,
                'total_weight_kg' => 64.0,
                'promised_at' => now()->addHours(6)
            ]);

            // 4. Group Orders inside an Active Dispatch Journey
            $dispatch = $warehouse->dispatches()->create([
                'tenant_id' => $tenant->id,
                'reference_code' => 'DSP-8841',
                'driver_name' => 'Marcus Idris',
                'vehicle_identifier' => 'VAN-014',
                'status' => DispatchStatus::InTransit,
                'scheduled_at' => now()->addHours(2),
                'departed_at' => now()
            ]);

            // 5. Sequence the Driver Map Stops Rows
            $dispatch->stops()->create([
                'tenant_id' => $tenant->id,
                'order_id' => $order1->id,
                'sequence' => 1,
                'destination_address' => $order1->shipping_address,
                'status' => StopStatus::Completed,
                'eta' => now()->addMinutes(30),
                'arrived_at' => now()->addMinutes(25),
                'completed_at' => now()->addMinutes(29)
            ]);

            $dispatch->stops()->create([
                'tenant_id' => $tenant->id,
                'order_id' => $order2->id,
                'sequence' => 2,
                'destination_address' => $order2->shipping_address,
                'status' => StopStatus::EnRoute,
                'eta' => now()->addHour()
            ]);
        });
    }
}
