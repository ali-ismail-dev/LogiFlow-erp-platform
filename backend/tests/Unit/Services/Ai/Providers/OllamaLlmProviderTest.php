<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Ai\Providers;

use App\DataTransferObjects\AiConversationRequest;
use App\Services\Ai\Providers\OllamaLlmProvider;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class OllamaLlmProviderTest extends TestCase
{
    #[Test]
    public function it_normalizes_a_successful_json_response_and_sends_context(): void
    {
        config([
            'services.ollama.base_url' => 'http://ollama.test/',
            'services.ollama.model' => 'llama-test',
        ]);
        Http::fake([
            'http://ollama.test/api/chat' => Http::response([
                'message' => [
                    'content' => json_encode([
                        'answer' => 'The route is on time.',
                        'citations' => [['type' => 'dispatch', 'id' => 'DSP-1', 'reason' => 'On time']],
                        'suggested_action' => null,
                        'confidence' => 'high',
                    ], JSON_THROW_ON_ERROR),
                ],
                'prompt_eval_count' => 12,
                'eval_count' => 7,
            ]),
        ]);

        $response = (new OllamaLlmProvider())->ask(new AiConversationRequest(
            prompt: 'How is the route?',
            userId: 1,
            tenantId: 2,
            contextHistory: [
                ['role' => 'user', 'content' => 'Earlier question'],
                ['role' => 'assistant', 'content' => 'Earlier answer'],
                ['role' => 'tool', 'tool_call_id' => 'call-1', 'content' => '{}'],
                ['role' => 'invalid', 'content' => 'Preserve as a normal message'],
                'invalid turn',
            ],
        ), [
            ['type' => 'function', 'function' => ['name' => 'get_status']],
        ]);

        $this->assertSame('llama-test', (new OllamaLlmProvider())->getModelName());
        $this->assertSame('ollama', (new OllamaLlmProvider())->getProviderName());
        $this->assertSame('The route is on time.', $response->answer);
        $this->assertSame(12, $response->promptTokens);
        $this->assertSame(7, $response->completionTokens);

        Http::assertSent(function ($request): bool {
            return $request->url() === 'http://ollama.test/api/chat'
                && $request['model'] === 'llama-test'
                && count($request['messages']) === 6
                && $request['tools'][0]['function']['name'] === 'get_status';
        });
    }

    #[Test]
    public function it_parses_tool_calls_with_string_and_array_arguments(): void
    {
        Http::fake([
            'http://localhost:11434/api/chat' => Http::response([
                'message' => [
                    'tool_calls' => [
                        ['id' => 'call-1', 'function' => ['name' => 'get_status', 'arguments' => '{"id":1}']],
                        ['function' => ['name' => 'get_risk', 'arguments' => ['limit' => 2]]],
                        ['function' => ['arguments' => []]],
                        'invalid',
                    ],
                ],
                'prompt_eval_count' => 3,
                'eval_count' => 2,
            ]),
        ]);

        $response = (new OllamaLlmProvider())->ask(new AiConversationRequest('Find risks', 1, 2));

        $this->assertSame('medium', $response->confidence);
        $this->assertSame(3, $response->promptTokens);
        $this->assertSame([
            ['id' => 'call-1', 'name' => 'get_status', 'arguments' => ['id' => 1]],
            ['id' => 'get_risk_1', 'name' => 'get_risk', 'arguments' => ['limit' => 2]],
        ], $response->pendingToolCalls);
    }

    #[Test]
    public function it_falls_back_for_http_errors_and_invalid_payloads(): void
    {
        $provider = new OllamaLlmProvider();
        Http::fake([
            'http://localhost:11434/api/chat' => Http::response(['error' => 'unavailable'], 503),
        ]);
        $failed = $provider->ask(new AiConversationRequest('Status?', 1, 2));

        Http::fake(fn(): never => throw new ConnectionException('timeout'));
        $timedOut = $provider->ask(new AiConversationRequest('Status?', 1, 2));

        Http::fake([
            'http://localhost:11434/api/chat' => Http::response(['message' => ['content' => 'not json']]),
        ]);
        $invalid = $provider->ask(new AiConversationRequest('Status?', 1, 2));

        foreach ([$failed, $timedOut, $invalid] as $response) {
            $this->assertSame('low', $response->confidence);
            $this->assertStringContainsString('temporarily unavailable', $response->answer);
        }
    }
}
