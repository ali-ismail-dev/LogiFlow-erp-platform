<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Paths this policy applies to
    |--------------------------------------------------------------------------
    | "sanctum/csrf-cookie" MUST be listed even though it lives outside
    | api/*  it's the endpoint the SPA hits first to receive the
    | XSRF-TOKEN cookie, and it needs the exact same cross-origin +
    | credentials treatment as the rest of the API.
    */
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    /*
    | Left empty on purpose. `allowed_origins: ['*']` is rejected outright
    | the moment `supports_credentials` is true (the CORS spec forbids
    | pairing a wildcard origin with credentialed requests), and listing
    | tenant subdomains one-by-one defeats the point of "wildcard tenant
    | subdomains." Pattern matching below is the correct mechanism.
    */
    'allowed_origins' => [],

    /*
    | One pattern for "the Next.js dev server itself" (no subdomain) and
    | one for "any tenant subdomain of it". Both pinned to port 3000 the
    | frontend's port, never the API's — and to http (plain-text dev).
    | 127.0.0.1 covers IP-literal access. Swap the scheme to https-only
    | and point these at the real frontend domain(s) before deploying.
    */
    'allowed_origins_patterns' => [
        '#^https?://localhost:3000$#',
        '#^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?\.localhost:3000$#',
        '#^https?://127\.0\.0\.1:3000$#',
    ],

    'allowed_headers' => ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN'],

    'exposed_headers' => [],

    'max_age' => 0,

    /*
    | REQUIRED for Sanctum's cookie-based SPA flow. Without this, the
    | browser executes the request but discards the response before your
    | JS ever sees it (the fetch throws / rejects) because Set-Cookie and
    | any credentialed response are opaque cross-origin without explicit
    | opt-in on both sides — this is the server side, `credentials: true`
    | + `withXSRFToken: true` on the Axios/fetch client is the other half.
    */
    'supports_credentials' => true,

];
