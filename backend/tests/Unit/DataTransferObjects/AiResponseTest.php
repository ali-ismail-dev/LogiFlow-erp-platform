<?php

declare(strict_types=1);

namespace Tests\Unit\DataTransferObjects;

use App\DataTransferObjects\AiResponse;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class AiResponseTest extends TestCase
{
    #[Test]
    public function it_serializes_answer_and_usage_data(): void
    {
        $response = new AiResponse(
            answer: 'Dispatch is on schedule.',
            citations: [['type' => 'dispatch', 'id' => 'DSP-1', 'reason' => 'On time']],
            toolsUsed: ['get_dispatch_status'],
            suggestedAction: ['type' => 'notify_customer'],
            confidence: 'medium',
            promptTokens: 100,
            completionTokens: 25,
            estimatedCost: 0.00125,
        );

        $this->assertSame([
            'answer' => 'Dispatch is on schedule.',
            'citations' => [['type' => 'dispatch', 'id' => 'DSP-1', 'reason' => 'On time']],
            'tools_used' => ['get_dispatch_status'],
            'suggested_action' => ['type' => 'notify_customer'],
            'confidence' => 'medium',
            'usage' => [
                'prompt_tokens' => 100,
                'completion_tokens' => 25,
                'total_tokens' => 125,
                'estimated_cost_usd' => 0.00125,
            ],
        ], $response->toArray());
    }
}
