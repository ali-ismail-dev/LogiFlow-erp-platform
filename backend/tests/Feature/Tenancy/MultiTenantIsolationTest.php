<?php

/**
 * Feature tests verifying fail-closed multi-tenant isolation on the
 * /api/v1/dispatches endpoints.
 *
 * ASSUMPTIONS (adjust to match the real Phase 2/7 schema if these differ):
 *  - App\Models\Tenant has: id, name, subdomain
 *  - App\Models\User has: tenant_id (FK to tenants)
 *  - App\Models\Dispatch has: tenant_id (FK to tenants) and is scoped by a
 *    global scope bound to the currently-resolved tenant
 *  - Tenant resolution happens via middleware reading the request's Host
 *    header (subdomain) — either binding the tenant into the container, or
 *    throwing App\Exceptions\TenantContextNotResolvedException when no
 *    tenant matches
 *  - Factories exist: Tenant::factory(), User::factory(), Dispatch::factory()
 *
 * If tenant resolution instead reads a header/JWT claim/etc., only
 * dispatchesEndpointAs() below needs to change — every assertion is
 * agnostic to the resolution mechanism itself.
 */

namespace Tests\Feature\Tenancy;

use App\Exceptions\TenantContextNotResolvedException;
use App\Models\Dispatch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;
use App\Enums\UserRole;

class MultiTenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenantA;
    private Tenant $tenantB;
    private User $userA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenantA = Tenant::factory()->create([
            'name' => 'Tenant A Logistics',
            'slug' => 'tenant-a',
        ]);

        $this->tenantB = Tenant::factory()->create([
            'name' => 'Tenant B Logistics',
            'slug' => 'tenant-b',
        ]);

        $this->userA = User::factory()->create([
            'tenant_id' => $this->tenantA->id,
            'role' => UserRole::SuperAdmin, // or whatever role is appropriate for the test
        ]);
    }

    /**
     * Issues a request as $user, with the Host header set to $tenant's
     * subdomain, so subdomain-based tenant resolution middleware picks up
     * the intended tenant context for this request.
     */
    private function dispatchesEndpointAs(User $user, Tenant $tenant, string $uri = '/api/v1/dispatches'): TestResponse
    {
        $absoluteUri = 'http://' . $tenant->slug . '.logiflow.test' . $uri;

        return $this->actingAs($user)->getJson($absoluteUri);
    }

    #[Test]
    public function tenant_a_index_response_omits_all_tenant_b_dispatches(): void
    {
        $tenantADispatches = Dispatch::factory()->count(5)->create(['tenant_id' => $this->tenantA->id]);
        $tenantBDispatches = Dispatch::factory()->count(5)->create(['tenant_id' => $this->tenantB->id]);

        $response = $this->dispatchesEndpointAs($this->userA, $this->tenantA);

        $response->assertOk();

        $returnedIds = collect($response->json('data'))->pluck('id')->all();

        // Tenant A must see exactly its own dispatches — no more, no fewer.
        $this->assertEqualsCanonicalizing($tenantADispatches->pluck('id')->all(), $returnedIds);

        // Belt-and-suspenders: explicitly confirm no Tenant B id slipped in.
        foreach ($tenantBDispatches as $leaked) {
            $this->assertNotContains(
                $leaked->id,
                $returnedIds,
                "Tenant B dispatch #{$leaked->id} leaked into Tenant A's response payload."
            );
        }
    }

    #[Test]
    public function tenant_a_receives_not_found_for_an_explicit_tenant_b_dispatch_id(): void
    {
        $tenantBDispatch = Dispatch::factory()->create(['tenant_id' => $this->tenantB->id]);

        $response = $this->dispatchesEndpointAs(
            $this->userA,
            $this->tenantA,
            "/api/v1/dispatches/{$tenantBDispatch->id}"
        );

        // Fail-closed: a resource that exists, but not in this tenant's
        // scope, must look identical to a resource that doesn't exist.
        $response->assertNotFound();
    }

    #[Test]
    public function unresolvable_tenant_subdomain_fails_closed_via_exception(): void
    {
        $this->withoutExceptionHandling();

        $this->expectException(TenantContextNotResolvedException::class);

        // No tenant owns this subdomain at all — the resolver must refuse
        // to fall through to an ambient/default tenant.
        $this->actingAs($this->userA)->getJson('/api/v1/dispatches', [
            'Host' => 'ghost-tenant.localhost',
        ]);
    }
}
