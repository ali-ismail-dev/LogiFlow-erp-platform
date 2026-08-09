<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use App\Http\Middleware\ResolveBroadcastUser;
use App\Http\Middleware\TenantMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withBroadcasting(
        channels: __DIR__ . '/../routes/channels.php',
        attributes: [
            // The default `/broadcasting/auth` route gets the `web` group from
            // Laravel. We append `tenant` (slug/header resolution) and
            // `broadcast.user` (dev-only authenticated-user resolution for the
            // private-channel gate) so the auth handshake can succeed end to end.
            'middleware' => ['web', 'tenant', 'broadcast.user'],
        ],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // REQUIRED: Activates Sanctum's cross-domain SPA session cookie tracking layer
        $middleware->statefulApi();

        // ALIAS MAP: Links the short route handle 'tenant' to our strict isolation interceptor
        $middleware->alias([
            'tenant' => TenantMiddleware::class,
            'broadcast.user' => ResolveBroadcastUser::class,
        ]);

        // CRITICAL FIX: Laravel's built-in middleware priority reorders route
        // middleware so `auth:sanctum` (Authenticate) runs BEFORE our custom
        // `tenant` middleware. When Sanctum resolves the session user via
        // Auth::user(), the TenantScope global scope fires against a User
        // query *before* TenantManager has been resolved — throwing
        // TenantContextNotResolvedException (HTTP 500 on /auth/me).
        //
        // By explicitly elevating TenantMiddleware in the priority chain
        // (ABOVE Authenticate), the tenant boundary is always resolved first,
        // so Sanctum's user lookup is safely tenant-scoped.
        $middleware->priority([
            \Illuminate\Foundation\Http\Middleware\HandlePrecognitiveRequests::class,
            \Illuminate\Cookie\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests::class,
            \App\Http\Middleware\TenantMiddleware::class,
            \Illuminate\Auth\Middleware\Authenticate::class,
            \Illuminate\Auth\Middleware\Authorize::class,
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Guarantees all API errors return clean JSON structures instead of HTML splash views
        $exceptions->shouldRenderJsonWhen(
            fn(Request $request) => $request->is('api/*'),
        );
    })->create();
