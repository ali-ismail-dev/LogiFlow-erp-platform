<?php

declare(strict_types=1);

namespace Tests\Feature\Middleware;

use App\Http\Middleware\TenantContextMiddleware;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use App\Support\Tenancy\TenantResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

final class TenantBoundaryMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenantA;
    private Tenant $tenantB;
    private User $userA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenantA = Tenant::factory()->create(['slug' => 'tenant-a']);
        $this->tenantB = Tenant::factory()->create(['slug' => 'tenant-b']);
        $this->userA = User::factory()->create(['tenant_id' => $this->tenantA->id]);
    }

    private function currentTenantAsBearer(string $token, string $tenantSlug): TestResponse
    {
        return $this->withToken($token)->getJson('/api/v1/tenants/current', [
            'X-Tenant-ID' => $tenantSlug,
        ]);
    }

    #[Test]
    public function a_bearer_token_can_read_its_own_tenant(): void
    {
        $token = $this->userA->createToken('rsc-test')->plainTextToken;

        $this->currentTenantAsBearer($token, 'tenant-a')->assertOk();
    }

    #[Test]
    public function a_bearer_token_probe_of_another_tenant_returns_401_without_leaking_token_validity(): void
    {
        $token = $this->userA->createToken('rsc-test')->plainTextToken;

        // TenantScope filters the Sanctum user lookup first, so a cross-tenant bearer probe intentionally returns 401.
        $this->currentTenantAsBearer($token, 'tenant-b')->assertUnauthorized();
    }

    #[Test]
    public function a_session_user_can_read_its_own_tenant(): void
    {
        $this->actingAs($this->userA, 'web')
            ->getJson('/api/v1/tenants/current', ['X-Tenant-ID' => 'tenant-a'])
            ->assertOk();
    }

    #[Test]
    public function a_session_user_cannot_read_another_tenant(): void
    {
        $this->actingAs($this->userA, 'web')
            ->getJson('/api/v1/tenants/current', ['X-Tenant-ID' => 'tenant-b'])
            ->assertForbidden();
    }

    #[Test]
    public function the_login_route_allows_an_unauthenticated_request_with_a_valid_tenant(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'email' => $this->userA->email,
            'password' => 'password',
        ], [
            'X-Tenant-ID' => 'tenant-a',
        ])->assertOk();
    }

    #[Test]
    public function the_health_check_allows_an_unauthenticated_request_without_a_tenant(): void
    {
        $this->getJson('/up')->assertOk();
    }

    #[Test]
    public function tenant_context_does_not_abort_when_the_user_is_null(): void
    {
        $tenantManager = $this->app->make(TenantManager::class);
        $tenantResolver = $this->app->make(TenantResolver::class);
        $middleware = new TenantContextMiddleware($tenantManager, $tenantResolver);
        $request = Request::create('/api/v1/tenants/current', 'GET', [], [], [], [
            'HTTP_X_TENANT_ID' => 'tenant-a',
        ]);

        $response = $middleware->handle($request, static fn(): Response => new Response('OK'));

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame($this->tenantA->id, $tenantManager->getTenant()?->id);
    }
}
