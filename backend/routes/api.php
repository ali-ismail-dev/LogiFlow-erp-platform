<?php

use App\Http\Controllers\Api\V1\DispatchController;
use App\Http\Controllers\Api\V1\Webhooks\CarrierWebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — v1
|--------------------------------------------------------------------------
| Middleware sequencing is deterministic. Non-tenant server-to-server 
| webhooks bypass standard session cookie validations using explicit filters.
*/

// Secure, optimized public gateway path matching the Phase 7/8 contract verbatim
Route::post('/v1/webhooks/carrier/{carrier}', CarrierWebhookController::class)
    ->name('api.v1.webhooks.carrier');

Route::middleware(['tenant', 'auth:sanctum'])
    ->prefix('v1')
    ->name('api.v1.')
    ->group(function (): void {
        Route::get('/dispatches', [DispatchController::class, 'index'])
            ->name('dispatches.index');
    });
