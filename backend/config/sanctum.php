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
    'stateful' => explode(',', (string) env(
        'SANCTUM_STATEFUL_DOMAINS',
        'localhost,localhost:3000,127.0.0.1,127.0.0.1:3000,' . Sanctum::currentApplicationUrlWithPort()
    )),

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
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],

];
