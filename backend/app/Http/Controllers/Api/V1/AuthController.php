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
            Auth::logout();
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
     */
    public function logout(Request $request): JsonResponse
    {
        Auth::logout();

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
