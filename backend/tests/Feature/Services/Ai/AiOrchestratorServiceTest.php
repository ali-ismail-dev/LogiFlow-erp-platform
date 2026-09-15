<?php

declare(strict_types=1);

namespace Tests\Feature\Services\Ai;

use App\Contracts\LlmProviderInterface;
use App\DataTransferObjects\AiConversationRequest;
use App\DataTransferObjects\AiResponse;
use App\Models\AiAuditLog;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Ai\AiOrchestratorService;
use App\Services\Ai\ToolRegistry;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

final class AiOrchestratorServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        app(TenantManager::class)->clear();
        Mockery::close();

        parent::tearDown();
    }

    #[Test]
    public function it_rejects_requests_without_matching_tenant_context(): void
    {
        $tenant = Tenant::factory()->create();
        app(TenantManager::class)->resolve($tenant);

        $service = new AiOrchestratorService(
            Mockery::mock(LlmProviderInterface::class),
            Mockery::mock(ToolRegistry::class),
            app(TenantManager::class),
        );

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Tenant context could not be verified');

        $service->process(new AiConversationRequest('Status?', 1, $tenant->id + 1));
    }

    #[Test]
    public function it_returns_a_final_response_and_records_usage_in_the_audit_log(): void
    {
        $tenant = Tenant::factory()->create();
        app(TenantManager::class)->resolve($tenant);
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $provider = Mockery::mock(LlmProviderInterface::class);
        $provider->shouldReceive('ask')->once()->andReturn(new AiResponse(
            answer: 'All routes are on time.',
            toolsUsed: ['summary'],
            promptTokens: 10,
            completionTokens: 5,
            estimatedCost: 0.002,
        ));
        $provider->shouldReceive('getProviderName')->once()->andReturn('test');
        $provider->shouldReceive('getModelName')->once()->andReturn('test-v1');
        $registry = Mockery::mock(ToolRegistry::class);
        $registry->shouldReceive('getToolDefinitions')->once()->andReturn([]);

        $response = $this->service($provider, $registry, $tenant)->process(
            new AiConversationRequest(str_repeat('status ', 40), $user->id, $tenant->id),
        );

        $this->assertSame('All routes are on time.', $response->answer);
        $this->assertSame(10, $response->promptTokens);
        $this->assertSame(5, $response->completionTokens);
        $this->assertSame(0.002, $response->estimatedCost);
        $this->assertDatabaseHas('ai_audit_logs', [
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'provider' => 'test',
            'total_tokens' => 15,
            'prompt_summary' => str_repeat('status ', 40) === '' ? '' : substr(str_repeat('status ', 40), 0, 200) . '...',
        ]);
    }

    #[Test]
    public function it_executes_tool_calls_and_aggregates_each_hop(): void
    {
        $tenant = Tenant::factory()->create();
        app(TenantManager::class)->resolve($tenant);
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $provider = Mockery::mock(LlmProviderInterface::class);
        $provider->shouldReceive('ask')->twice()->andReturn(
            new AiResponse(
                answer: '',
                pendingToolCalls: [['id' => 'call-1', 'name' => 'get_status', 'arguments' => ['dispatch_id' => 1]]],
                promptTokens: 20,
                completionTokens: 3,
                estimatedCost: 0.001,
            ),
            new AiResponse(
                answer: 'Dispatch is moving.',
                toolsUsed: ['get_status'],
                promptTokens: 12,
                completionTokens: 4,
                estimatedCost: 0.002,
            ),
        );
        $provider->shouldReceive('getProviderName')->once()->andReturn('test');
        $provider->shouldReceive('getModelName')->once()->andReturn('test-v1');
        $registry = Mockery::mock(ToolRegistry::class);
        $registry->shouldReceive('getToolDefinitions')->once()->andReturn([]);
        $registry->shouldReceive('executeTool')->once()->with('get_status', ['dispatch_id' => 1], $tenant->id)
            ->andReturn(['status' => 'in_transit']);

        $response = $this->service($provider, $registry, $tenant)->process(
            new AiConversationRequest('Where is dispatch 1?', $user->id, $tenant->id),
        );

        $this->assertSame('Dispatch is moving.', $response->answer);
        $this->assertSame(['get_status'], $response->toolsUsed);
        $this->assertSame(32, $response->promptTokens);
        $this->assertSame(7, $response->completionTokens);
        $this->assertSame(0.003, $response->estimatedCost);
        $this->assertSame(1, AiAuditLog::query()->count());
    }

    private function service(
        LlmProviderInterface $provider,
        ToolRegistry $registry,
        Tenant $tenant,
    ): AiOrchestratorService {
        return new AiOrchestratorService($provider, $registry, app(TenantManager::class));
    }
}
