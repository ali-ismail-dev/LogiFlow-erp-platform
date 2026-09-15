<?php

declare(strict_types=1);

namespace App\Services\Ai;

use App\Contracts\AiToolInterface;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Central, tenant-aware registry and dispatcher for Copilot tools. Nothing
 * calls a tool directly — everything routes through executeTool() so tenant
 * scoping and failure handling are enforced in exactly one place.
 */
class ToolRegistry
{
    /** @var array<string, AiToolInterface> */
    private array $tools = [];

    /**
     * @param iterable<AiToolInterface> $tools
     */
    public function __construct(iterable $tools = [])
    {
        foreach ($tools as $tool) {
            $this->registerTool($tool);
        }
    }

    public function registerTool(AiToolInterface $tool): void
    {
        $this->tools[$tool->getName()] = $tool;
    }

    public function getTool(string $name): ?AiToolInterface
    {
        return $this->tools[$name] ?? null;
    }

    /**
     * @return array<int, AiToolInterface>
     */
    public function getAllTools(): array
    {
        return array_values($this->tools);
    }

    /**
     * OpenAI-compatible function-calling definitions for every registered tool.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getToolDefinitions(): array
    {
        return array_map(
            static fn(AiToolInterface $tool): array => [
                'type' => 'function',
                'function' => [
                    'name' => $tool->getName(),
                    'description' => $tool->getDescription(),
                    'parameters' => $tool->getParameterSchema(),
                ],
            ],
            $this->getAllTools(),
        );
    }

    /**
     * Look up and run a tool by name, always passing $tenantId through so
     * every tool implementation enforces its own tenant isolation. Never
     * throws — unknown tools and execution failures both come back as a
     * safe error payload instead of bubbling up.
     *
     * @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    public function executeTool(string $name, array $arguments, int $tenantId): array
    {
        $tool = $this->getTool($name);

        if ($tool === null) {
            return ['error' => "Unknown tool: {$name}"];
        }

        try {
            return $tool->execute($arguments, $tenantId);
        } catch (Throwable $exception) {
            Log::error('AI tool execution failed', [
                'tool' => $name,
                'tenant_id' => $tenantId,
                'exception' => $exception->getMessage(),
            ]);

            return ['error' => "The '{$name}' tool failed to execute."];
        }
    }
}
