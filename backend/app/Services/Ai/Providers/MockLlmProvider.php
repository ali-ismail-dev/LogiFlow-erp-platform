<?php

declare(strict_types=1);

namespace App\Services\Ai\Providers;

use App\Contracts\LlmProviderInterface;
use App\DataTransferObjects\AiConversationRequest;
use App\DataTransferObjects\AiResponse;
use Illuminate\Support\Str;

/**
 * Deterministic, zero-cost LLM provider used for local development, demos,
 * and automated tests. Routes prompts to canned but realistically shaped
 * AiResponse payloads based on keyword matching, so downstream consumers
 * (controllers, front-end, cost metering) can be built and exercised before
 * a real provider (OpenAI, Ollama, etc.) is wired in.
 */
class MockLlmProvider implements LlmProviderInterface
{
    private const int MOCK_PROMPT_TOKENS = 150;
    private const int MOCK_COMPLETION_TOKENS = 85;
    private const float MOCK_ESTIMATED_COST = 0.000350;

    public function getProviderName(): string
    {
        return 'mock';
    }

    public function getModelName(): string
    {
        return 'mock-v1';
    }

    /**
     * @param array<int, array<string, mixed>>|array<int, string> $availableTools
     */
    public function ask(AiConversationRequest $request, array $availableTools = []): AiResponse
    {
        $prompt = Str::lower($request->prompt);

        return match (true) {
            $this->matchesAny($prompt, ['delay', 'risk', 'late', 'overdue', 'sla'])
            => $this->delayedDispatchResponse($availableTools),

            $this->matchesAny($prompt, ['driver', 'workload', 'shift', 'capacity'])
            => $this->driverWorkloadResponse($availableTools),

            default => $this->genericSummaryResponse($availableTools),
        };
    }

    /**
     * @param array<int, string> $needles
     */
    private function matchesAny(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (Str::contains($haystack, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<int, array<string, mixed>>|array<int, string> $availableTools
     */
    private function delayedDispatchResponse(array $availableTools): AiResponse
    {
        return new AiResponse(
            answer: 'I found 2 dispatches currently at risk of missing their SLA window. '
                . 'DSP-1042 has 2 overdue stops and is trending toward a breach within the '
                . 'next 45 minutes. I\'d recommend reassigning the final stop to a driver '
                . 'with more slack, or notifying the customer proactively.',
            citations: [
                ['type' => 'dispatch', 'id' => 'DSP-1042', 'reason' => '2 overdue stops, high SLA risk'],
                ['type' => 'driver', 'id' => 'DRV-882', 'reason' => 'Active shift exceeds target load by 35%'],
            ],
            toolsUsed: $this->resolveToolsUsed($availableTools, ['dispatch_lookup', 'sla_risk_scan']),
            suggestedAction: [
                'type' => 'reassign_stop',
                'dispatch_id' => 'DSP-1042',
                'reason' => 'Reduce SLA breach risk by redistributing the overdue stop',
            ],
            confidence: 'high',
            promptTokens: self::MOCK_PROMPT_TOKENS,
            completionTokens: self::MOCK_COMPLETION_TOKENS,
            estimatedCost: self::MOCK_ESTIMATED_COST,
        );
    }

    /**
     * @param array<int, array<string, mixed>>|array<int, string> $availableTools
     */
    private function driverWorkloadResponse(array $availableTools): AiResponse
    {
        return new AiResponse(
            answer: 'Looking at today\'s active shifts, DRV-882 is carrying 35% more stops '
                . 'than the target load for their route zone, while DRV-511 is running under '
                . 'capacity. Rebalancing 2-3 stops from DRV-882 to DRV-511 would even out both '
                . 'shifts without affecting delivery windows.',
            citations: [
                ['type' => 'driver', 'id' => 'DRV-882', 'reason' => 'Active shift exceeds target load by 35%'],
                ['type' => 'driver', 'id' => 'DRV-511', 'reason' => 'Under target load, available capacity for 3 stops'],
            ],
            toolsUsed: $this->resolveToolsUsed($availableTools, ['driver_workload_scan', 'route_capacity_lookup']),
            suggestedAction: [
                'type' => 'rebalance_stops',
                'from_driver_id' => 'DRV-882',
                'to_driver_id' => 'DRV-511',
                'stop_count' => 3,
            ],
            confidence: 'medium',
            promptTokens: self::MOCK_PROMPT_TOKENS,
            completionTokens: self::MOCK_COMPLETION_TOKENS,
            estimatedCost: self::MOCK_ESTIMATED_COST,
        );
    }

    /**
     * @param array<int, array<string, mixed>>|array<int, string> $availableTools
     */
    private function genericSummaryResponse(array $availableTools): AiResponse
    {
        return new AiResponse(
            answer: 'Operations are running within normal parameters. Across active '
                . 'dispatches, on-time performance is holding steady and no drivers are '
                . 'currently flagged for overload. Let me know if you\'d like a deeper look '
                . 'at a specific dispatch, driver, or route zone.',
            citations: [
                ['type' => 'dispatch', 'id' => 'DSP-1042', 'reason' => '2 overdue stops, high SLA risk'],
                ['type' => 'driver', 'id' => 'DRV-882', 'reason' => 'Active shift exceeds target load by 35%'],
            ],
            toolsUsed: $this->resolveToolsUsed($availableTools, ['operations_summary']),
            suggestedAction: null,
            confidence: 'high',
            promptTokens: self::MOCK_PROMPT_TOKENS,
            completionTokens: self::MOCK_COMPLETION_TOKENS,
            estimatedCost: self::MOCK_ESTIMATED_COST,
        );
    }

    /**
     * Prefer whichever of the caller's available tools actually apply to this
     * response; fall back to the mock's own default tool list when the caller
     * didn't restrict tool availability at all.
     *
     * @param array<int, array<string, mixed>>|array<int, string> $availableTools
     * @param array<int, string> $preferredTools
     * @return array<int, string>
     */
    private function resolveToolsUsed(array $availableTools, array $preferredTools): array
    {
        $availableNames = $this->extractToolNames($availableTools);

        if ($availableNames === []) {
            return $preferredTools;
        }

        $matched = array_values(array_intersect($preferredTools, $availableNames));

        return $matched === [] ? array_slice($availableNames, 0, 1) : $matched;
    }

    /**
     * Accepts plain tool-name strings and OpenAI-style function definitions.
     *
     * @param array<int, array<string, mixed>>|array<int, string> $availableTools
     * @return array<int, string>
     */
    private function extractToolNames(array $availableTools): array
    {
        return array_values(array_filter(array_map(
            static fn(mixed $tool): ?string => is_string($tool)
                ? $tool
                : (is_array($tool) && is_array($tool['function'] ?? null)
                    ? ($tool['function']['name'] ?? null)
                    : null),
            $availableTools,
        )));
    }
}
