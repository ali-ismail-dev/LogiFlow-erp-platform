<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\DataTransferObjects\AiConversationRequest;
use App\DataTransferObjects\AiResponse;
use App\Enums\UserRole;
use App\Http\Controllers\Api\AiCopilotController;
use App\Http\Requests\AiCopilotRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Ai\AiOrchestratorService;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

final class AiCopilotControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();

        parent::tearDown();
    }

    #[Test]
    public function it_returns_the_orchestrator_payload_for_authenticated_tenant_users(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Dispatcher,
        ]);

        $tenantManager = app(TenantManager::class);
        $tenantManager->resolve($tenant);

        $orchestrator = Mockery::mock(AiOrchestratorService::class);
        $orchestrator->shouldReceive('process')->once()->withArgs(function (AiConversationRequest $conversationRequest) use ($user, $tenant): bool {
            return $conversationRequest->prompt === 'Summarize fleet health'
                && $conversationRequest->userId === $user->id
                && $conversationRequest->tenantId === $tenant->id
                && $conversationRequest->userRole === 'dispatcher';
        })->andReturn(new AiResponse(
            answer: 'Operations are running within normal parameters.',
            confidence: 'high',
            promptTokens: 10,
            completionTokens: 5,
            estimatedCost: 0.001,
        ));

        $controller = new AiCopilotController($orchestrator, $tenantManager);

        $request = new AiCopilotRequest();
        $request->setUserResolver(fn() => $user);
        $request->merge([
            'prompt' => 'Summarize fleet health',
            'context_history' => [['role' => 'user', 'content' => 'Previous turn']],
        ]);

        $response = $controller->ask($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Operations are running within normal parameters.', $response->getData(true)['data']['answer']);
        $this->assertSame('high', $response->getData(true)['data']['confidence']);
    }

    #[Test]
    public function it_returns_an_unauthorized_response_when_no_user_is_present(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $tenantManager = app(TenantManager::class);
        $tenantManager->resolve($tenant);

        $orchestrator = Mockery::mock(AiOrchestratorService::class);
        $controller = new AiCopilotController($orchestrator, $tenantManager);

        $request = new AiCopilotRequest();
        $request->setUserResolver(fn() => null);
        $request->merge(['prompt' => 'Summarize fleet health']);

        $response = $controller->ask($request);

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame('Authentication required.', $response->getData(true)['error']);
    }

    #[Test]
    public function it_returns_forbidden_when_no_tenant_context_is_present(): void
    {
        $tenantManager = app(TenantManager::class);
        $tenantManager->clear();

        $user = new User([
            'id' => 999,
            'name' => 'No Tenant User',
            'email' => 'notenant@example.com',
            'role' => UserRole::Dispatcher,
            'tenant_id' => null,
        ]);

        $orchestrator = Mockery::mock(AiOrchestratorService::class);
        $controller = new AiCopilotController($orchestrator, $tenantManager);

        $request = new AiCopilotRequest();
        $request->setUserResolver(fn() => $user);
        $request->merge(['prompt' => 'Summarize fleet health']);

        $response = $controller->ask($request);

        $this->assertSame(403, $response->getStatusCode());
        $this->assertSame('No tenant context could be resolved for this request.', $response->getData(true)['error']);
    }

    #[Test]
    public function it_returns_a_service_unavailable_response_when_the_orchestrator_throws(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'acme']);
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Dispatcher,
        ]);

        $tenantManager = app(TenantManager::class);
        $tenantManager->resolve($tenant);

        $orchestrator = Mockery::mock(AiOrchestratorService::class);
        $orchestrator->shouldReceive('process')->once()->andThrow(new RuntimeException('Service exploded'));

        $controller = new AiCopilotController($orchestrator, $tenantManager);

        $request = new AiCopilotRequest();
        $request->setUserResolver(fn() => $user);
        $request->merge(['prompt' => 'Summarize fleet health']);

        $response = $controller->ask($request);

        $this->assertSame(503, $response->getStatusCode());
        $this->assertSame('The AI Copilot is temporarily unavailable. Please try again shortly.', $response->getData(true)['error']);
    }
}
