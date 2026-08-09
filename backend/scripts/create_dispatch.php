<?php

use App\Models\Tenant;
use App\Models\Dispatch;
use App\Support\Tenancy\TenantManager;
use App\Events\DispatchMovementUpdated;

$tenant = Tenant::where('slug', 'nike')->first();

if (! $tenant) {
    echo ">>> Tenant 'nike' not found. Ensure the seeder has run.\n";
    return;
}

$manager = app(TenantManager::class);
$manager->clear();
$manager->resolve($tenant);

// Initialize a completely new, independent manifest run entry row
// FIXED: The dispatch manifest is now explicitly assigned to our freshly
// provisioned corporate driver, Sarah Thomas, instead of the dispatch
// operator Brian OConner. This keeps the manifests aligned with the real
// database user roster where Sarah holds the 'driver' role.
$dispatch = Dispatch::create([
    'tenant_id' => $tenant->id,
    'reference_code' => 'DSP-REVERB-SUCCESS-100',
    'driver_name' => 'Sarah Thomas',
    'vehicle_identifier' => 'VAN-EMERALD-01',
    'status' => 'in_transit',
    'departed_at' => now()->toIso8601String(),
]);

// Fire the real-time WebSocket broadcast event straight down the network wire
event(new DispatchMovementUpdated($dispatch));

echo "\n>>> TELEMETRY PACKET EMITTED FOR DSP-REVERB-SUCCESS-100! WATCH YOUR DASHBOARD NOW.\n";
