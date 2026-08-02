<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves an authenticated user for the private broadcast channel gate.
 *
 * Reverb/Pusher's `PusherBroadcaster::auth()` refuses private-* channel
 * authorization with a 403 unless a non-null user is resolved from the
 * request *before* the channel callback even runs. This app has no session
 * login flow for the dashboard (the RSC fetches data server-to-server via
 * the X-Tenant-ID header), so in local/testing environments we synthesize a
 * per-tenant user so the private-channel handshake can succeed.
 *
 * In production this middleware is a strict no-op: the real session auth
 * stack remains the sole arbiter of the private-channel gate.
 */
final class ResolveBroadcastUser
{
    public function __construct(
        private readonly TenantManager $tenantManager,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Production/staging must rely on genuine session authentication.
        if (! app()->isLocal() && ! app()->environment('testing')) {
            return $next($request);
        }

        // TenantMiddleware (runs before this) guarantees TenantManager is
        // resolved; if it somehow isn't, do not fabricate identity.
        if (! $this->tenantManager->check()) {
            return $next($request);
        }

        $tenantId = $this->tenantManager->id;

        // Reuse a single synthetic dev user per tenant so the auth signature
        // stays stable across reconnect handshakes within a browser tab.
        $user = User::query()
            ->where('tenant_id', $tenantId)
            ->first();

        if ($user === null) {
            $user = User::create([
                'tenant_id' => $tenantId,
                'name' => 'Broadcast Sync User',
                'email' => 'broadcast+' . $tenantId . '@logiflow.local',
                'password' => Str::random(64),
            ]);
        }

        // Point the request's user resolver at the synthetic user so
        // PusherBroadcaster::retrieveUser() -> $request->user() succeeds.
        $request->setUserResolver(static fn (): ?User => $user);

        return $next($request);
    }
}

