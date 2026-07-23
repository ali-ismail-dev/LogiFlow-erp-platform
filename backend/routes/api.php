<?php

use App\Http\Controllers\Api\V1\DispatchController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — v1
|--------------------------------------------------------------------------
| Middleware order is deliberate: `tenant` runs first so an unrecognized
| subdomain fails closed with a 404 before we even look for a session —
| an invalid tenant should never reveal whether a valid session exists.
| `auth:sanctum` then confirms the (host-only, tenant-scoped) session
| cookie belongs to an authenticated user of *this* tenant.
*/

Route::middleware(['tenant', 'auth:sanctum'])
    ->prefix('v1')
    ->name('api.v1.')
    ->group(function (): void {
        Route::get('/dispatches', [DispatchController::class, 'index'])
            ->name('dispatches.index');
    });
