<?php

declare(strict_types=1);

namespace App\DataTransferObjects;

/**
 * Immutable input payload passed into an LlmProviderInterface::ask() call.
 */
readonly class AiConversationRequest
{
    /**
     * @param array<int, array<string, mixed>> $contextHistory Prior turns. Plain chat
     *        turns are shaped like ['role' => 'user'|'assistant', 'content' => string].
     *        During tool-calling orchestration this may also contain an assistant
     *        turn carrying 'tool_calls', and 'tool' role turns carrying
     *        'tool_call_id' + 'content' with that call's result — see
     *        AiOrchestratorService, which appends these automatically.
     */
    public function __construct(
        public string $prompt,
        public int $userId,
        public int $tenantId,
        public string $userRole = 'dispatcher',
        public array $contextHistory = [],
    ) {}
}
