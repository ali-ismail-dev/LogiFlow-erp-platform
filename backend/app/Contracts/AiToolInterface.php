<?php

declare(strict_types=1);

namespace App\Contracts;

/**
 * Contract for a single, tenant-safe, read-only Copilot tool. Every
 * implementation MUST scope its own queries to the given $tenantId and
 * MUST NOT return data belonging to another tenant under any circumstance.
 */
interface AiToolInterface
{
    /**
     * Machine-readable tool name (snake_case), used for function-call routing.
     */
    public function getName(): string;

    /**
     * Human-readable description surfaced to the LLM so it knows when to call this tool.
     */
    public function getDescription(): string;

    /**
     * JSON-schema-like description of accepted parameters, e.g.:
     * ['type' => 'object', 'properties' => [...], 'required' => [...]].
     *
     * @return array<string, mixed>
     */
    public function getParameterSchema(): array;

    /**
     * Execute the tool. Implementations must enforce tenant isolation on
     * every query they run using $tenantId, and must validate/sanitize
     * every value read out of $arguments before using it.
     *
     * @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    public function execute(array $arguments, int $tenantId): array;
}
