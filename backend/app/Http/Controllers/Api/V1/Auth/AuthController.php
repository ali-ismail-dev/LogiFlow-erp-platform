<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

final class AuthController extends Controller
{
    /**
     * Handle an inbound stateful login attempt.
     */
    public function login(LoginRequest $request, TenantManager $tenantManager): JsonResponse
    {
        $credentials = $request->validated();

        if (! Auth::attempt($credentials, (bool) $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        /** @var \App\Models\User $user */
        $user = Auth::user();

        if ($user->isRscService()) {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            // Return the same response as a wrong password so the login endpoint
            // never reveals that a dedicated RSC service principal exists.
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        if ((int) $user->tenant_id !== (int) $tenantManager->id) {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            return response()->json([
                'message' => 'Unauthorized tenant boundary violation entry attempt.'
            ], 403);
        }

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json([
            'message' => 'Authenticated successfully.',
            'user' => new UserResource($user),
        ], 200);
    }

    /**
     * Terminate the active authenticated session cookie mesh.
     */
    public function logout(Request $request): JsonResponse
    {
        Auth::shouldUse('web');

        if (Auth::guard('web')->check()) {
            Auth::guard('web')->logout();
        }

        $request->setUserResolver(static fn() => null);

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'message' => 'Logged out successfully.'
        ], 200);
    }

    /**
     * Fetch the currently authenticated user mapping payload.
     */
    public function me(): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        return response()->json([
            'data' => new UserResource($user)
        ], 200);
    }
}
