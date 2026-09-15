<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Ai;

use App\Contracts\AiToolInterface;
use App\Services\Ai\ToolRegistry;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class ToolRegistryTest extends TestCase
{
    #[Test]
    public function it_registers_tools_and_builds_function_definitions(): void
    {
        $tool = new class implements AiToolInterface {
            public function getName(): string
            {
                return 'example_tool';
            }

            public function getDescription(): string
            {
                return 'An example tool.';
            }

            public function getParameterSchema(): array
            {
                return ['type' => 'object', 'properties' => []];
            }

            public function execute(array $arguments, int $tenantId): array
            {
                return ['tenant_id' => $tenantId, 'arguments' => $arguments];
            }
        };

        $registry = new ToolRegistry([$tool]);

        $this->assertSame($tool, $registry->getTool('example_tool'));
        $this->assertSame([$tool], $registry->getAllTools());
        $this->assertSame([
            [
                'type' => 'function',
                'function' => [
                    'name' => 'example_tool',
                    'description' => 'An example tool.',
                    'parameters' => ['type' => 'object', 'properties' => []],
                ],
            ],
        ], $registry->getToolDefinitions());
    }

    #[Test]
    public function it_dispatches_tools_with_the_tenant_id_and_handles_unknown_tools(): void
    {
        $tool = new class implements AiToolInterface {
            public function getName(): string
            {
                return 'example_tool';
            }

            public function getDescription(): string
            {
                return '';
            }

            public function getParameterSchema(): array
            {
                return [];
            }

            public function execute(array $arguments, int $tenantId): array
            {
                return ['tenant_id' => $tenantId, 'arguments' => $arguments];
            }
        };

        $registry = new ToolRegistry([$tool]);

        $this->assertSame(
            ['tenant_id' => 42, 'arguments' => ['status' => 'active']],
            $registry->executeTool('example_tool', ['status' => 'active'], 42),
        );
        $this->assertSame(
            ['error' => 'Unknown tool: missing_tool'],
            $registry->executeTool('missing_tool', [], 42),
        );
    }
}
