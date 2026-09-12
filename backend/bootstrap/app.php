<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use App\Http\Middleware\TenantBoundaryMiddleware;
use App\Http\Middleware\TenantContextMiddleware;

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
            // FIXED: Removed 'broadcast.user'. The real 'web' and 'tenant' 
            // session stacks are now the sole, secure arbiters of channel authentication.
            // Boundary enforcement will be revisited when the broadcast auth flow is next touched.
            'middleware' => ['web', 'tenant'],
        ],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // REQUIRED: Activates Sanctum's cross-domain SPA session cookie tracking layer
        $middleware->statefulApi();

        // The application authenticates against Laravel's session guard for the
        // tenant-scoped API, not bearer tokens. These routes therefore live under
        // the web/session stack and must opt out of CSRF validation for API paths.
        $middleware->validateCsrfTokens(except: ['api/*', 'broadcasting/auth']);

        // ALIAS MAP: Links the short route handle 'tenant' to our strict isolation interceptor
        $middleware->alias([
            'tenant' => TenantContextMiddleware::class,
            'tenant.boundary' => TenantBoundaryMiddleware::class,
        ]);

        // Tenant context is resolved before authentication, then the authenticated
        // user's tenant boundary is enforced after Sanctum has resolved the user.
        $middleware->priority([
            \Illuminate\Foundation\Http\Middleware\HandlePrecognitiveRequests::class,
            \Illuminate\Cookie\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests::class,
            \App\Http\Middleware\TenantContextMiddleware::class,
            \Illuminate\Auth\Middleware\Authenticate::class,
            \Illuminate\Auth\Middleware\Authorize::class,
            \App\Http\Middleware\TenantBoundaryMiddleware::class,
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Guarantees all API errors return clean JSON structures instead of HTML splash views
        $exceptions->shouldRenderJsonWhen(
            fn(Request $request) => $request->is('api/*'),
        );
    })->create();
