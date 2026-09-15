<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\DataTransferObjects\AiConversationRequest;
use App\Http\Controllers\Controller;
use App\Http\Requests\AiCopilotRequest;
use App\Services\Ai\AiOrchestratorService;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * POST /api/v1/ai/ask — single entry point for the LogiFlow AI Operations
 * Copilot. Tenant context is resolved from TenantManager populated earlier in
 * the request lifecycle, rather than trusted from client-supplied input.
 */
class AiCopilotController extends Controller
{
    public function __construct(
        private readonly AiOrchestratorService $orchestrator,
        private readonly TenantManager $tenantManager,
    ) {}

    public function ask(AiCopilotRequest $request): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return response()->json(['error' => 'Authentication required.'], 401);
        }

        $tenantId = $this->tenantManager->id;

        if ($tenantId === null) {
            return response()->json(['error' => 'No tenant context could be resolved for this request.'], 403);
        }

        $role = $user->role;
        $userRole = $role instanceof \BackedEnum
            ? (string) $role->value
            : (string) ($role ?? 'dispatcher');

        $conversationRequest = new AiConversationRequest(
            prompt: (string) $request->input('prompt'),
            userId: (int) $user->id,
            tenantId: $tenantId,
            userRole: $userRole,
            contextHistory: (array) $request->input('context_history', []),
        );

        try {
            $response = $this->orchestrator->process($conversationRequest);
        } catch (Throwable $exception) {
            Log::error('AI Copilot request failed', [
                'tenant_id' => $tenantId,
                'user_id' => $user->id,
                'exception' => $exception->getMessage(),
            ]);

            return response()->json([
                'error' => 'The AI Copilot is temporarily unavailable. Please try again shortly.',
            ], 503);
        }

        return response()->json(['data' => $response->toArray()], 200);
    }
}
