<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Ai\Providers;

use App\DataTransferObjects\AiConversationRequest;
use App\Services\Ai\Providers\OpenAiLlmProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class OpenAiLlmProviderTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_uses_configured_model_and_pricing_for_a_successful_response(): void
    {
        config([
            'services.openai.model' => 'gpt-4.1-mini',
            'services.openai.pricing.input_per_1k' => 0.001,
            'services.openai.pricing.output_per_1k' => 0.002,
        ]);

        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'answer' => 'Dispatch is on schedule.',
                            'citations' => [],
                            'suggested_action' => null,
                            'confidence' => 'high',
                        ], JSON_THROW_ON_ERROR),
                    ],
                ]],
                'usage' => [
                    'prompt_tokens' => 1000,
                    'completion_tokens' => 500,
                ],
            ]),
        ]);

        $response = (new OpenAiLlmProvider)->ask(new AiConversationRequest(
            prompt: 'Is the dispatch on schedule?',
            userId: 1,
            tenantId: 1,
        ));

        $this->assertSame('gpt-4.1-mini', (new OpenAiLlmProvider)->getModelName());
        $this->assertSame('Dispatch is on schedule.', $response->answer);
        $this->assertSame(0.002, $response->estimatedCost);

        Http::assertSent(function ($request): bool {
            return $request->url() === 'https://api.openai.com/v1/chat/completions'
                && $request['model'] === 'gpt-4.1-mini';
        });
    }

    #[Test]
    public function it_returns_a_graceful_fallback_when_openai_times_out(): void
    {
        Http::fake(fn(): never => throw new ConnectionException('The request timed out.'));

        $response = (new OpenAiLlmProvider)->ask(new AiConversationRequest(
            prompt: 'What is the current fleet status?',
            userId: 1,
            tenantId: 1,
        ));

        $this->assertSame(
            'The AI Copilot is temporarily unavailable. Please try again in a moment.',
            $response->answer,
        );
        $this->assertSame('low', $response->confidence);
        $this->assertSame(0, $response->promptTokens);
        $this->assertSame(0, $response->completionTokens);
        $this->assertSame(0.0, $response->estimatedCost);
    }
}
