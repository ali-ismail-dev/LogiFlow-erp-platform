<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Paths this policy applies to
    |--------------------------------------------------------------------------
    */
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => [],

    /*
    | FIXED: Upgraded regex mappings to support flexible dynamic local port 
    | ranges (3000-3005). This prevents local environment port collision drops.
    | Handles both bare hosts and nested multi-tenant local subdomains safely.
    */
    'allowed_origins_patterns' => [
        '#^https?://localhost:300[0-5]$#',
        '#^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?\.localhost:300[0-5]$#',
        '#^https?://127\.0\.0\.1:300[0-5]$#',
    ],

    'allowed_headers' => ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN', 'X-Tenant-ID'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
