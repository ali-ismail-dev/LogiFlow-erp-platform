<?php

use Laravel\Sanctum\Sanctum;

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful Domains
    |--------------------------------------------------------------------------
    | Requests whose Origin/Referer matches one of these get session-cookie
    | + CSRF treatment; everything else is treated as a stateless
    | bearer-token client. Matched with Str::is(), so the `*.localhost:3000`
    | wildcard genuinely matches every tenant subdomain — confirmed against
    | Sanctum's EnsureFrontendRequestsAreStateful::fromFrontend() source.
    | Value comes entirely from .env; see SANCTUM_STATEFUL_DOMAINS.
    */
    'stateful' => array_values(array_unique(array_filter(array_merge(
        // Explicit env-provided stateful domains (highest priority).
        explode(',', (string) env('SANCTUM_STATEFUL_DOMAINS', '')),
        // Default local-development hosts.
        ['localhost', '127.0.0.1', 'localhost:3000', '127.0.0.1:3000'],
        // Full local tenant-subdomain wildcard coverage for the Next.js dev
        // port range (3000–3005) — required so requests from
        // `nike.localhost:3001` are treated as stateful SPA traffic and get
        // the session + CSRF middleware applied.
        ['*.localhost:3000', '*.localhost:3001', '*.localhost:3002', '*.localhost:3003', '*.localhost:3004', '*.localhost:3005'],
        // The URL Laravel believes it is served on (usually http://localhost:8000).
        [Sanctum::currentApplicationUrlWithPort()],
    )))),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Guards
    |--------------------------------------------------------------------------
    | The auth guard(s) Sanctum falls back to when authenticating a
    | stateful request. "web" is the session guard every tenant request
    | ultimately authenticates against once the cookie is validated.
    */
    'guard' => ['web'],

    /*
    |--------------------------------------------------------------------------
    | Expiration Minutes
    |--------------------------------------------------------------------------
    | Governs personal access tokens (mobile/3rd-party API clients), not
    | the SPA cookie session itself — that follows config/session.php's
    | own lifetime. Null = tokens never expire; tighten this if LogiFlow
    | issues long-lived tokens to external integrations later.
    */
    'expiration' => null,

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Middleware
    |--------------------------------------------------------------------------
    | Standard framework middleware Sanctum layers onto a stateful request:
    | cookie encryption, CSRF validation, and (optionally) hard session
    | invalidation the moment a user's password changes elsewhere.
    */
    'middleware' => [
        // NOTE: `authenticate_session` is intentionally omitted. It runs inside
        // Sanctum's global EnsureFrontendRequestsAreStateful pipeline, which
        // executes BEFORE the route-level `tenant` middleware. It would call
        // `$request->user()` (triggering a User query) before the tenant context
        // is resolved, throwing a 500 "Tenant context not resolved" error on
        // every authenticated route. The `auth:sanctum` guard still
        // authenticates from the session correctly after the tenant resolves.
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],

];
