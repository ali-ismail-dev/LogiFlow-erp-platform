<?php

declare(strict_types=1);

namespace App\Services\Ai\Providers;

use App\Contracts\LlmProviderInterface;
use App\DataTransferObjects\AiConversationRequest;
use App\DataTransferObjects\AiResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Talks to a self-hosted Ollama instance through its /api/chat endpoint.
 * Ollama runs locally, so estimatedCost is always zero.
 */
class OllamaLlmProvider implements LlmProviderInterface
{
    private const string DEFAULT_BASE_URL = 'http://localhost:11434';
    private const string DEFAULT_MODEL = 'llama3';

    private const string SYSTEM_PROMPT = <<<'PROMPT'
        You are LogiFlow's AI Operations Copilot. Answer logistics operations
        questions concisely and only use information returned by tool calls or
        supplied conversation context. Never invent dispatch, driver, or stop
        details. When a tool would help answer the question, call it before
        responding.

        Once you have enough information, respond with a single JSON object
        (no prose outside the JSON) shaped exactly like:
        {"answer": string, "citations": [{"type": string, "id": string, "reason": string}], "suggested_action": object|null, "confidence": "low"|"medium"|"high"}
        PROMPT;

    public function getProviderName(): string
    {
        return 'ollama';
    }

    public function getModelName(): string
    {
        return (string) config('services.ollama.model', self::DEFAULT_MODEL);
    }

    /**
     * @param array<int, array<string, mixed>> $availableTools
     */
    public function ask(AiConversationRequest $request, array $availableTools = []): AiResponse
    {
        $baseUrl = rtrim((string) config('services.ollama.base_url', self::DEFAULT_BASE_URL), '/');

        $payload = [
            'model' => $this->getModelName(),
            'messages' => $this->buildMessages($request),
            'stream' => false,
        ];

        if ($availableTools !== []) {
            $payload['tools'] = $availableTools;
        }

        try {
            $response = Http::timeout(60)->post("{$baseUrl}/api/chat", $payload);
        } catch (Throwable $exception) {
            Log::error('Ollama request failed', ['exception' => $exception->getMessage()]);

            return $this->fallbackResponse();
        }

        if ($response->failed()) {
            Log::error('Ollama returned an error response', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return $this->fallbackResponse();
        }

        return $this->toAiResponse($response->json() ?? []);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildMessages(AiConversationRequest $request): array
    {
        $messages = [
            ['role' => 'system', 'content' => self::SYSTEM_PROMPT],
        ];

        foreach ($request->contextHistory as $turn) {
            $message = $this->sanitizeContextTurn($turn);

            if ($message !== null) {
                $messages[] = $message;
            }
        }

        $messages[] = ['role' => 'user', 'content' => $request->prompt];

        return $messages;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function sanitizeContextTurn(mixed $turn): ?array
    {
        if (! is_array($turn) || ! isset($turn['role']) || ! is_string($turn['role'])) {
            return null;
        }

        return match ($turn['role']) {
            'assistant' => array_filter(
                [
                    'role' => 'assistant',
                    'content' => isset($turn['content']) ? (string) $turn['content'] : null,
                    'tool_calls' => is_array($turn['tool_calls'] ?? null) ? $turn['tool_calls'] : null,
                ],
                static fn(mixed $value): bool => $value !== null,
            ),
            'tool' => [
                'role' => 'tool',
                'tool_call_id' => (string) ($turn['tool_call_id'] ?? ''),
                'content' => (string) ($turn['content'] ?? ''),
            ],
            default => [
                'role' => $turn['role'],
                'content' => (string) ($turn['content'] ?? ''),
            ],
        };
    }

    /**
     * @param array<string, mixed> $body
     */
    private function toAiResponse(array $body): AiResponse
    {
        $message = $body['message'] ?? null;

        if (! is_array($message)) {
            return $this->fallbackResponse();
        }

        $promptTokens = (int) ($body['prompt_eval_count'] ?? 0);
        $completionTokens = (int) ($body['eval_count'] ?? 0);
        $toolCalls = $message['tool_calls'] ?? null;

        if (is_array($toolCalls) && $toolCalls !== []) {
            return new AiResponse(
                answer: '',
                pendingToolCalls: $this->parseToolCalls($toolCalls),
                confidence: 'medium',
                promptTokens: $promptTokens,
                completionTokens: $completionTokens,
                estimatedCost: 0.0,
            );
        }

        $content = $message['content'] ?? null;
        $decoded = is_string($content) ? json_decode($content, true) : null;

        if (! is_array($decoded) || ! isset($decoded['answer'])) {
            return $this->fallbackResponse();
        }

        return new AiResponse(
            answer: (string) $decoded['answer'],
            citations: is_array($decoded['citations'] ?? null) ? $decoded['citations'] : [],
            suggestedAction: is_array($decoded['suggested_action'] ?? null) ? $decoded['suggested_action'] : null,
            confidence: in_array($decoded['confidence'] ?? null, ['low', 'medium', 'high'], true)
                ? $decoded['confidence']
                : 'medium',
            promptTokens: $promptTokens,
            completionTokens: $completionTokens,
            estimatedCost: 0.0,
        );
    }

    /**
     * @param array<int, array<string, mixed>> $toolCalls
     * @return array<int, array{id: string, name: string, arguments: array<string, mixed>}> 
     */
    private function parseToolCalls(array $toolCalls): array
    {
        $parsed = [];

        foreach ($toolCalls as $index => $call) {
            if (! is_array($call)) {
                continue;
            }

            $function = $call['function'] ?? null;
            $name = is_array($function) ? ($function['name'] ?? null) : null;

            if (! is_string($name)) {
                continue;
            }

            $rawArguments = is_array($function) ? ($function['arguments'] ?? []) : [];
            $arguments = is_string($rawArguments) ? json_decode($rawArguments, true) : $rawArguments;

            $parsed[] = [
                'id' => (string) ($call['id'] ?? "{$name}_{$index}"),
                'name' => $name,
                'arguments' => is_array($arguments) ? $arguments : [],
            ];
        }

        return $parsed;
    }

    private function fallbackResponse(): AiResponse
    {
        return new AiResponse(
            answer: 'The AI Copilot is temporarily unavailable. Please try again in a moment.',
            confidence: 'low',
        );
    }
}
