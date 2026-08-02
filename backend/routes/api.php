<?php

use App\Http\Controllers\Api\V1\DispatchController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Controllers\Api\V1\Webhooks\CarrierWebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — v1
|--------------------------------------------------------------------------
*/

// Secure public gateway endpoint for third-party inbound carrier webhooks
Route::post('/v1/webhooks/carrier/{carrier}', CarrierWebhookController::class)
    ->name('api.v1.webhooks.carrier');

// Public Tenant-Scoped Endpoint: Login must run before session tokens exist
Route::middleware(['tenant'])
    ->prefix('v1')
    ->group(function (): void {
        Route::post('/auth/login', [AuthController::class, 'login'])->name('api.v1.auth.login');
    });

// Protected Tenant-Scoped Endpoints: Require a resolved tenant and a valid Sanctum session
Route::middleware(['tenant', 'auth:sanctum'])
    ->prefix('v1')
    ->name('api.v1.')
    ->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    });

// Tenant-Scoped Operational Endpoints: Tenant-resolved but NOT auth-protected.
// The React Server Component (RSC) fetches these during SSR from the internal
// Docker network (http://webserver) where no browser session cookie exists.
// Authentication is implicit via the X-Tenant-ID header + network isolation.
Route::middleware(['tenant'])
    ->prefix('v1')
    ->name('api.v1.')
    ->group(function (): void {
        Route::get('/dispatches', [DispatchController::class, 'index'])->name('dispatches.index');
        Route::get('/tenants/current', [TenantController::class, 'current'])->name('tenants.current');
    });
