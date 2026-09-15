<?php

declare(strict_types=1);

namespace App\Contracts;

use App\DataTransferObjects\AiConversationRequest;
use App\DataTransferObjects\AiResponse;

/**
 * Contract every LLM backend (mock, OpenAI, local Ollama, etc.) must satisfy
 * so the rest of the Copilot stack never depends on a concrete provider.
 */
interface LlmProviderInterface
{
    /**
     * @param array<int, array<string, mixed>> $availableTools OpenAI-compatible function
     *        definitions (as produced by ToolRegistry::getToolDefinitions()) the provider
     *        may offer to the model. Providers that don't support tool calling may ignore
     *        this entirely; the mock provider also tolerates a plain list of tool-name
     *        strings for backward compatibility.
     */
    public function ask(AiConversationRequest $request, array $availableTools = []): AiResponse;

    /**
     * Short machine-readable identifier for this provider, e.g. 'mock', 'openai'.
     */
    public function getProviderName(): string;

    /**
     * Concrete model identifier this provider is currently using, e.g. 'gpt-4o',
     * 'llama3', 'mock-v1'. Used for usage/audit logging.
     */
    public function getModelName(): string;
}
