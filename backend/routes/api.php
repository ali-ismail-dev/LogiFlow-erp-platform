<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AiCopilotController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\PublicRegistrationController;
use App\Http\Controllers\Api\V1\Logistics\DispatchController;
use App\Http\Controllers\Api\V1\Logistics\DriverController;
use App\Http\Controllers\Api\V1\Logistics\VehicleController;
use App\Http\Controllers\Api\V1\DispatchOptimizationController;
use App\Http\Controllers\Api\V1\Workspace\OrderController;
use App\Http\Controllers\Api\V1\Workspace\TenantController;
use App\Http\Controllers\Api\V1\Workspace\UserController;
use App\Http\Controllers\Api\V1\Workspace\WarehouseController;
use App\Http\Controllers\Api\V1\Webhooks\CarrierWebhookController;

/*
|--------------------------------------------------------------------------
| API Routes — v1
|--------------------------------------------------------------------------
*/

// Secure public gateway endpoint for third-party inbound carrier webhooks
Route::post('/v1/webhooks/carrier/{carrier}', CarrierWebhookController::class)
    ->middleware('throttle:60,1')
    ->name('api.v1.webhooks.carrier');

// Phase 8 Public SaaS Corporate Onboarding Gate Pathway
Route::post('/v1/public/register', [PublicRegistrationController::class, 'register'])
    ->name('api.v1.public.register');

// Public Tenant-Scoped Endpoint: Login must run before session tokens exist
Route::middleware(['web', 'tenant', 'throttle:5,1'])
    ->prefix('v1')
    ->group(function (): void {
        Route::post('/auth/login', [AuthController::class, 'login'])->name('api.v1.auth.login');
    });

// Protected Tenant-Scoped Endpoints: Require a resolved tenant, an active web session,
// and a valid Sanctum session so logout and identity reads operate on the real session store.
Route::middleware(['web', 'tenant', 'auth:sanctum', 'tenant.boundary'])
    ->prefix('v1')
    ->name('api.v1.')
    ->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
        // The write-side employee provisioning endpoint stays inside the auth perimeter.
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        // Phase 3.1 Driver Domain endpoints — tenant-aware, auth-protected.
        Route::apiResource('drivers', DriverController::class)->only(['store']);
        // Phase 3.2 Fleet Domain endpoints — tenant-aware, auth-protected.
        Route::apiResource('vehicles', VehicleController::class)->only(['store']);
        // Phase 7.1 Warehouse Domain Endpoints — tenant-aware, auth-protected
        Route::apiResource('warehouses', WarehouseController::class)->only(['store']);
        // Phase 7.2 Manual Cargo Ingestion Endpoint — tenant-aware, auth-protected
        Route::apiResource('orders', OrderController::class)->only(['store']);
        // Manifest creation must occur inside the authenticated tenant workspace.
        Route::post('/dispatches', [DispatchController::class, 'store'])->name('dispatches.store');
        Route::post('/dispatches/optimize/recommend-vehicle', [DispatchOptimizationController::class, 'recommendVehicle'])->name('dispatches.optimize.recommend-vehicle');
        Route::post('/dispatches/optimize/suggest-split', [DispatchOptimizationController::class, 'suggestSplit'])->name('dispatches.optimize.suggest-split');
        Route::put('/dispatches/{dispatch}/assign', [DispatchController::class, 'assignFleet'])->name('dispatches.fleet.assign');
        Route::patch('/dispatches/{dispatch}/status', [DispatchController::class, 'updateStatus'])
            ->name('dispatches.status.update');
        Route::post('/ai/ask', [AiCopilotController::class, 'ask'])->name('ai.ask');
    });

// Tenant-Scoped Operational Endpoints: authenticated and tenant-resolved.
Route::middleware(['web', 'tenant', 'auth:sanctum', 'tenant.boundary'])
    ->prefix('v1')
    ->name('api.v1.')
    ->group(function (): void {
        Route::apiResource('drivers', DriverController::class)->only(['index']);
        Route::apiResource('vehicles', VehicleController::class)->only(['index']);
        Route::apiResource('warehouses', WarehouseController::class)->only(['index']);
        Route::apiResource('orders', OrderController::class)->only(['index']);
        Route::apiResource('dispatches', DispatchController::class)->only(['index']);
        Route::apiResource('users', UserController::class)->only(['index']);
        Route::get('/tenants/current', [TenantController::class, 'current'])->name('tenants.current');
    });

// Catch-all terminal fallback rule for un-mapped system endpoints
Route::fallback(function (): \Illuminate\Http\JsonResponse {
    return response()->json([
        'message' => 'The requested operational core endpoint does not exist or has been relocated within our architecture matrix.'
    ], 404);
});
