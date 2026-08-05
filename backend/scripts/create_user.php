<?php

use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Support\Facades\Hash;

$email = 'driver.brian@logiflow.test';
$password = 'LogiFlow@2026';

$tenant = Tenant::where('slug', 'nike')->first();

if (! $tenant) {
    echo ">>> Tenant 'nike' not found. Ensure the seeder has run.\n";
    return;
}

$manager = app(TenantManager::class);
$manager->clear();
$manager->resolve($tenant);

if (User::withoutTenancy()->where('email', $email)->exists()) {
    echo ">>> User already exists with email {$email}. Skipping creation.\n";
} else {
    // Create the user for the nike tenant.
    User::withoutTenancy()->create([
        'tenant_id' => $tenant->id,
        'name' => 'Brian OConner',
        'email' => $email,
        'password' => Hash::make($password),
        'role' => 'dispatcher',
    ]);
    echo ">>> User created.\n";
}

echo "\n>>> CREDENTIALS\n";
echo "    Tenant slug : nike\n";
echo "    Email       : {$email}\n";
echo "    Password    : {$password}\n";
echo "    Role        : dispatcher\n";
echo "\n>>> Log in at: http://nike.localhost:3000/login\n";
