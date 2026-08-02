<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels — Isolated Telemetry Operations Perimeters
|--------------------------------------------------------------------------
|
| Enforces an absolute, ironclad database row firewall directly at our 
| asynchronous socket transmission boundary.
|
*/

// FIXED: Channel definition registers universally across all environments and Reverb daemons
Broadcast::channel('tenant.{tenantId}.ops', function (User $user, string $tenantId): bool {
    // SECURITY GUARD A: Instantly block malicious or missing structural data context
    if (is_null($user->tenant_id)) {
        return false;
    }

    // SECURITY GUARD B: Deny un-onboarded platform accounts completely via strict string match
    // Compares the user's tenant ID against the requested channel route parameter fragment
    return (string) $user->tenant_id === trim($tenantId);
});
