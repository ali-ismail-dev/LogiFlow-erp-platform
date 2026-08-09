<?php

declare(strict_types=1);

/**
 * Feature tests verifying the /api/v1/users store endpoint safely resolves
 * the X-Tenant-ID slug header into a numeric BIGINT tenant_id before writing.
 *
 * These tests exercise the SAME middleware stack + controller used in
 * production (TenantMiddleware → auth:sanctum → UserController@store),
 * sidestepping the curl/Sanctum session-cookie limitation that blocks
 * an equivalent live HTTP sweep.
 */

namespace Tests\Feature\Tenancy;

use App\Enums\UserRole;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class UserInvitationTenantTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create([
            'name' => 'Nike Logistics',
            'slug' => 'nike',
            'is_active' => true,
        ]);
    }

    /**
     * Issue a stateful (Sanctum) POST /api/v1/users request as the given user,
     * with an explicit X-Tenant-ID header so the tenant resolution path is
     * exercised exactly as the browser does.
     */
    private function postUserAs(User $user, string $tenantSlug, array $payload): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($user)->postJson(
            '/api/v1/users',
            $payload,
            ['X-Tenant-ID' => $tenantSlug]
        );
    }

    #[Test]
    public function store_resolves_x_tenant_id_slug_to_numeric_tenant_id(): void
    {
        $admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role' => UserRole::SuperAdmin,
        ]);

        $response = $this->postUserAs($admin, 'nike', [
            'name' => 'Jane Cooper',
            'email' => 'jane.cooper@nike.com',
            'role' => 'dispatcher',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.tenant_id', $this->tenant->id);
        $response->assertJsonPath('data.role', 'dispatcher');
        $response->assertJsonPath('data.email', 'jane.cooper@nike.com');

        // Confirm the DB row actually persisted the numeric BIGINT tenant_id.
        $this->assertDatabaseHas('users', [
            'email' => 'jane.cooper@nike.com',
            'tenant_id' => $this->tenant->id,
        ]);

        $this->assertSame($this->tenant->id, User::where('email', 'jane.cooper@nike.com')->first()->tenant_id);
    }

    #[Test]
    public function store_without_tenant_header_returns_404_not_500(): void
    {
        $admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role' => UserRole::SuperAdmin,
        ]);

        // No X-Tenant-ID header and no resolvable subdomain → must fail closed as 404.
        $response = $this->actingAs($admin)->postJson('/api/v1/users', [
            'name' => 'Jane Cooper',
            'email' => 'jane.cooper@nike.com',
            'role' => 'dispatcher',
        ]);

        $response->assertNotFound();
        $response->assertJsonStructure(['message']);
    }

    #[Test]
    public function store_with_invalid_tenant_slug_returns_404_not_500(): void
    {
        $admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role' => UserRole::SuperAdmin,
        ]);

        $response = $this->postUserAs($admin, 'ghost-tenant', [
            'name' => 'Jane Cooper',
            'email' => 'jane.cooper@nike.com',
            'role' => 'dispatcher',
        ]);

        $response->assertNotFound();
        $response->assertJsonStructure(['message']);
    }
}
