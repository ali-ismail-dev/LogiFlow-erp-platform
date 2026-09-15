<?php

declare(strict_types=1);

namespace App\Services\Ai;

use App\Contracts\LlmProviderInterface;
use App\DataTransferObjects\AiConversationRequest;
use App\DataTransferObjects\AiResponse;
use App\Models\AiAuditLog;
use App\Support\Tenancy\TenantManager;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Drives one full Copilot turn: asks the active provider for an answer,
 * executes requested tools within a bounded number of hops, records usage,
 * and returns the final normalized response.
 */
class AiOrchestratorService
{
    private const int MAX_TOOL_CALL_HOPS = 4;

    public function __construct(
        private readonly LlmProviderInterface $llmProvider,
        private readonly ToolRegistry $toolRegistry,
        private readonly TenantManager $tenantManager,
    ) {}

    public function process(AiConversationRequest $request): AiResponse
    {
        $this->assertTenantContextMatches($request);

        $toolDefinitions = $this->toolRegistry->getToolDefinitions();
        $contextHistory = $request->contextHistory;
        $toolsCalled = [];
        $totalPromptTokens = 0;
        $totalCompletionTokens = 0;
        $totalCost = 0.0;

        $response = $this->llmProvider->ask($request, $toolDefinitions);

        for ($hop = 0; $hop < self::MAX_TOOL_CALL_HOPS; $hop++) {
            $totalPromptTokens += $response->promptTokens;
            $totalCompletionTokens += $response->completionTokens;
            $totalCost += $response->estimatedCost;

            if ($response->pendingToolCalls === null || $response->pendingToolCalls === []) {
                break;
            }

            [$contextHistory, $calledThisHop] = $this->executeToolCalls(
                $response->pendingToolCalls,
                $contextHistory,
                $request->tenantId,
            );

            $toolsCalled = [...$toolsCalled, ...$calledThisHop];

            $response = $this->llmProvider->ask(
                new AiConversationRequest(
                    prompt: $request->prompt,
                    userId: $request->userId,
                    tenantId: $request->tenantId,
                    userRole: $request->userRole,
                    contextHistory: $contextHistory,
                ),
                $toolDefinitions,
            );
        }

        $finalResponse = new AiResponse(
            answer: $response->answer,
            citations: $response->citations,
            toolsUsed: array_values(array_unique([...$response->toolsUsed, ...$toolsCalled])),
            suggestedAction: $response->suggestedAction,
            confidence: $response->confidence,
            promptTokens: $totalPromptTokens,
            completionTokens: $totalCompletionTokens,
            estimatedCost: round($totalCost, 6),
        );

        $this->recordAuditLog($request, $finalResponse);

        return $finalResponse;
    }

    /**
     * @param array<int, array{id: string, name: string, arguments: array<string, mixed>}> $pendingToolCalls
     * @param array<int, array<string, mixed>> $contextHistory
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, string>}
     */
    private function executeToolCalls(array $pendingToolCalls, array $contextHistory, int $tenantId): array
    {
        $calledTools = [];

        $contextHistory[] = [
            'role' => 'assistant',
            'content' => null,
            'tool_calls' => array_map(
                static fn(array $call): array => [
                    'id' => $call['id'],
                    'type' => 'function',
                    'function' => [
                        'name' => $call['name'],
                        'arguments' => json_encode($call['arguments'], JSON_THROW_ON_ERROR),
                    ],
                ],
                $pendingToolCalls,
            ),
        ];

        foreach ($pendingToolCalls as $call) {
            $result = $this->toolRegistry->executeTool($call['name'], $call['arguments'], $tenantId);
            $calledTools[] = $call['name'];

            $contextHistory[] = [
                'role' => 'tool',
                'tool_call_id' => $call['id'],
                'name' => $call['name'],
                'content' => json_encode($result, JSON_THROW_ON_ERROR),
            ];
        }

        return [$contextHistory, $calledTools];
    }

    private function assertTenantContextMatches(AiConversationRequest $request): void
    {
        $resolvedTenantId = $this->tenantManager->id;

        if ($resolvedTenantId === null || $resolvedTenantId !== $request->tenantId) {
            Log::error('AI Copilot tenant context mismatch', [
                'request_tenant_id' => $request->tenantId,
                'resolved_tenant_id' => $resolvedTenantId,
            ]);

            throw new RuntimeException('Tenant context could not be verified for this request.');
        }
    }

    private function recordAuditLog(AiConversationRequest $request, AiResponse $response): void
    {
        AiAuditLog::create([
            'tenant_id' => $request->tenantId,
            'user_id' => $request->userId,
            'provider' => $this->llmProvider->getProviderName(),
            'model' => $this->llmProvider->getModelName(),
            'prompt_tokens' => $response->promptTokens,
            'completion_tokens' => $response->completionTokens,
            'total_tokens' => $response->promptTokens + $response->completionTokens,
            'estimated_cost' => $response->estimatedCost,
            'tools_called' => $response->toolsUsed,
            'prompt_summary' => $this->summarizePrompt($request->prompt),
        ]);
    }

    private function summarizePrompt(string $prompt): string
    {
        return mb_strlen($prompt) > 200 ? mb_substr($prompt, 0, 200) . '...' : $prompt;
    }
}
