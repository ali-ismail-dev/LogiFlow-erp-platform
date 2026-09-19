<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Ai\Providers;

use App\DataTransferObjects\AiConversationRequest;
use App\Services\Ai\Providers\OpenAiLlmProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class OpenAiLlmProviderCoverageTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_handles_tool_call_responses_and_error_payloads(): void
    {
        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::sequence()
                ->push([
                    'choices' => [[
                        'message' => [
                            'tool_calls' => [[
                                'id' => 'call_123',
                                'function' => [
                                    'name' => 'get_dispatch_status',
                                    'arguments' => json_encode(['dispatch_id' => 'DSP-42']),
                                ],
                            ]],
                        ],
                    ]],
                    'usage' => [
                        'prompt_tokens' => 180,
                        'completion_tokens' => 90,
                    ],
                ])
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'answer' => 'Response parsed.',
                                'citations' => [['type' => 'dispatch', 'id' => 'DSP-42', 'reason' => 'matched']],
                                'suggested_action' => ['type' => 'status', 'dispatch_id' => 'DSP-42'],
                                'confidence' => 'low',
                            ], JSON_THROW_ON_ERROR),
                        ],
                    ]],
                    'usage' => [
                        'prompt_tokens' => 200,
                        'completion_tokens' => 50,
                    ],
                ]),
        ]);

        $response = (new OpenAiLlmProvider)->ask(new AiConversationRequest(
            prompt: 'Check this dispatch',
            userId: 1,
            tenantId: 1,
            contextHistory: [
                ['role' => 'user', 'content' => 'Earlier context'],
                ['role' => 'assistant', 'content' => 'Earlier answer'],
            ],
        ));

        $this->assertSame('', $response->answer);
        $this->assertSame('medium', $response->confidence);
        $this->assertSame('get_dispatch_status', $response->pendingToolCalls[0]['name']);
        $this->assertSame(0.00135, round($response->estimatedCost, 6));

        $parsed = (new OpenAiLlmProvider)->ask(new AiConversationRequest(
            prompt: 'Check next dispatch',
            userId: 1,
            tenantId: 1,
        ));

        $this->assertSame('Response parsed.', $parsed->answer);
        $this->assertSame('low', $parsed->confidence);
        $this->assertSame('dispatch', $parsed->citations[0]['type']);
    }

    #[Test]
    public function it_returns_a_fallback_when_the_provider_responds_with_a_bad_payload(): void
    {
        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => '{not-json'],
                ]],
                'usage' => [
                    'prompt_tokens' => 40,
                    'completion_tokens' => 20,
                ],
            ]),
        ]);

        $response = (new OpenAiLlmProvider)->ask(new AiConversationRequest(
            prompt: 'Check a bad payload',
            userId: 1,
            tenantId: 1,
        ));

        $this->assertSame('The AI Copilot is temporarily unavailable. Please try again in a moment.', $response->answer);
        $this->assertSame('low', $response->confidence);
    }

    #[Test]
    public function it_uses_the_configured_default_provider_defaults(): void
    {
        config(['services.openai.model' => '']);

        $this->assertSame('', (new OpenAiLlmProvider)->getModelName());
        $this->assertSame('openai', (new OpenAiLlmProvider)->getProviderName());
    }
}
