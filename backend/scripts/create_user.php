<?php

use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Support\Facades\Hash;

$password = 'LogiFlow@2026';

$tenant = Tenant::where('slug', 'nike')->first();

if (! $tenant) {
    echo ">>> Tenant 'nike' not found. Ensure the seeder has run.\n";
    return;
}

$manager = app(TenantManager::class);
$manager->clear();
$manager->resolve($tenant);

// FIXED: Provision the corporate driver roster (Sarah Thomas holds the 'driver'
// role) alongside the dispatch operator (Brian OConner holds the 'dispatcher'
// role). This guarantees the dashboard's active_drivers metric derives from a
// real database row tagged with the lowercase 'driver' role parameter key.
$roster = [
    [
        'name' => 'Sarah Thomas',
        'email' => 'driver.sarah@logiflow.test',
        'role' => 'driver',
    ],
    [
        'name' => 'Brian OConner',
        'email' => 'driver.brian@logiflow.test',
        'role' => 'dispatcher',
    ],
];

foreach ($roster as $entry) {
    if (User::withoutTenancy()->where('email', $entry['email'])->exists()) {
        echo ">>> User already exists with email {$entry['email']}. Skipping creation.\n";
        continue;
    }

    // Create the user for the nike tenant.
    User::withoutTenancy()->create([
        'tenant_id' => $tenant->id,
        'name' => $entry['name'],
        'email' => $entry['email'],
        'password' => Hash::make($password),
        'role' => $entry['role'],
    ]);
    echo ">>> User created: {$entry['name']} ({$entry['role']})\n";
}

echo "\n>>> CREDENTIALS\n";
echo "    Tenant slug : nike\n";
echo "    Password    : {$password}\n";
echo "    Driver      : driver.sarah@logiflow.test (role: driver)\n";
echo "    Dispatcher  : driver.brian@logiflow.test (role: dispatcher)\n";
echo "\n>>> Log in at: http://nike.localhost:3000/login\n";
