<?php

use App\Http\Controllers\Api\V1\DispatchController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DriverController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Controllers\Api\V1\Webhooks\CarrierWebhookController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\VehicleController;
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
Route::middleware(['web', 'tenant'])
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
        // The write-side employee provisioning endpoint stays inside the auth perimeter.
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        // Phase 3.1 Driver Domain endpoints — tenant-aware, auth-protected.
        Route::get('/drivers', [DriverController::class, 'index'])->name('drivers.index');
        Route::post('/drivers', [DriverController::class, 'store'])->name('drivers.store');
        // Phase 3.2 Fleet Domain endpoints — tenant-aware, auth-protected.
        Route::get('/vehicles', [VehicleController::class, 'index'])->name('vehicles.index');
        Route::post('/vehicles', [VehicleController::class, 'store'])->name('vehicles.store');
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
        // FIXED: Employee roster GET is now SSR-reachable (no session cookie needed over
        // the Docker internal network) so the dashboard's active_drivers metric can
        // derive from the real database driver-role rows instead of an empty roster.
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
    });
