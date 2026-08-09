<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
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
     *
     * @throws ValidationException
     */
    public function login(Request $request, TenantManager $tenantManager): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Guard A: Attempt authentication against the globally resolved tenant boundary
        if (! Auth::attempt($credentials, (bool) $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        /** @var \App\Models\User $user */
        $user = Auth::user();

        // Guard B: Deep multi-tenant cross-login interception firewall
        if ((int) $user->tenant_id !== (int) $tenantManager->id) {
            // This app uses Laravel's stateful session guard (not Sanctum API
            // tokens), so terminating the session is a pure session-store
            // operation: invalidate + regenerate the CSRF token.
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json([
                'message' => 'Unauthorized tenant boundary violation entry attempt.'
            ], 403);
        }

        // Senior Pattern: Regenerate the session ID to completely block Session Hijacking/Fixation attacks
        $request->session()->regenerate();

        return response()->json([
            'message' => 'Authenticated successfully.',
            'user' => new UserResource($user),
        ], 200);
    }

    /**
     * Terminate the active authenticated session cookie mesh.
     *
     * This application authenticates statefully via Laravel's session guard
     * (Sanctum in "web/" SPA mode defines the guard as a RequestGuard, which
     * has no logout() method). The correct session termination is therefore to
     * invalidate the session store and regenerate the CSRF token, which fully
     * drops the operator outside the corporate wall on the backend kernel.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->session()->invalidate();
        $request->session()->regenerateToken();

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
