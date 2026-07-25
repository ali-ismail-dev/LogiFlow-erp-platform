<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Tenant isolation is strictly enforced at the perimeter. This channel acts
| as an ironclad firewall preventing cross-tenant telemetry leakage.
|
*/

$broadcastingConnections = config('broadcasting.connections', []);
$shouldRegisterBroadcastChannels = ! app()->runningInConsole()
    && is_array($broadcastingConnections)
    && count($broadcastingConnections) > 0;

if ($shouldRegisterBroadcastChannels) {
    Broadcast::channel('tenant.{tenantId}.ops', function (User $user, string $tenantId): bool {
        // SECURITY GUARD A: Instantly block malicious SQL/Regex parameter strings
        if (! ctype_digit($tenantId)) {
            return false;
        }

        // SECURITY GUARD B: Deny un-onboarded platform or ambient accounts completely
        if (is_null($user->tenant_id)) {
            return false;
        }

        // SECURITY GUARD C: Strict integer type-alignment validation check
        return (int) $user->tenant_id === (int) $tenantId;
    });
}
