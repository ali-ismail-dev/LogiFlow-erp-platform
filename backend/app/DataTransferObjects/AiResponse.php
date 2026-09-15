<?php

declare(strict_types=1);

namespace App\DataTransferObjects;

/**
 * Immutable, normalized output from any LlmProviderInterface implementation.
 */
readonly class AiResponse
{
    /**
     * @param array<int, array<string, string>> $citations Structured references the
     *        answer is grounded in, e.g. ['type' => 'dispatch', 'id' => 'DSP-1042', 'reason' => '...'].
     * @param array<int, string> $toolsUsed Names of tools the provider invoked to answer.
     * @param array<string, mixed>|null $suggestedAction Optional actionable follow-up
     *        the UI can offer to the user, or null if none applies.
     * @param 'low'|'medium'|'high' $confidence
     * @param array<int, array{id: string, name: string, arguments: array<string, mixed>}>|null $pendingToolCalls
     *        Tool calls awaiting execution. Null or empty means this response is final.
     */
    public function __construct(
        public string $answer,
        public array $citations = [],
        public array $toolsUsed = [],
        public ?array $suggestedAction = null,
        public string $confidence = 'high',
        public int $promptTokens = 0,
        public int $completionTokens = 0,
        public float $estimatedCost = 0.0,
        public ?array $pendingToolCalls = null,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'answer' => $this->answer,
            'citations' => $this->citations,
            'tools_used' => $this->toolsUsed,
            'suggested_action' => $this->suggestedAction,
            'confidence' => $this->confidence,
            'usage' => [
                'prompt_tokens' => $this->promptTokens,
                'completion_tokens' => $this->completionTokens,
                'total_tokens' => $this->promptTokens + $this->completionTokens,
                'estimated_cost_usd' => $this->estimatedCost,
            ],
        ];
    }
}
