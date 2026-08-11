<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\UserRole;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class SecurityIdentityIntegrationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function test_user_can_authenticate_and_mint_session_cookie(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Nike Logistics',
            'slug' => 'nike',
            'is_active' => true,
        ]);

        $plainPassword = 'Password123!';
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::SuperAdmin,
            'name' => 'Nike Ops Admin',
            'email' => 'ops@nike.com',
            'password' => Hash::make($plainPassword),
        ]);

        $token = 'test-token';

        $response = $this->withCookie('XSRF-TOKEN', $token)
            ->withSession(['_token' => $token])
            ->postJson('/api/v1/auth/login', [
                'email' => 'ops@nike.com',
                'password' => $plainPassword,
            ], [
                'X-Tenant-ID' => 'nike',
                'X-CSRF-TOKEN' => $token,
                'X-XSRF-TOKEN' => $token,
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Authenticated successfully.')
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonPath('user.tenant_id', $tenant->id)
            ->assertJsonPath('user.role', UserRole::SuperAdmin->value)
            ->assertCookie('laravel_session');

        $this->assertAuthenticatedAs($user);
    }

    #[Test]
    public function test_authenticated_user_can_fetch_identity_profile_and_logout(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Nike Logistics',
            'slug' => 'nike',
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::SuperAdmin,
            'email' => 'profile@nike.com',
            'password' => Hash::make('Password123!'),
        ]);

        $token = 'test-token';

        $this->withCookie('XSRF-TOKEN', $token)
            ->withSession(['_token' => $token])
            ->postJson('/api/v1/auth/login', [
                'email' => 'profile@nike.com',
                'password' => 'Password123!',
            ], [
                'X-Tenant-ID' => 'nike',
                'X-CSRF-TOKEN' => $token,
                'X-XSRF-TOKEN' => $token,
            ])
            ->assertOk();

        $this->getJson('/api/v1/auth/me', ['X-Tenant-ID' => 'nike'])
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.email', $user->email)
            ->assertJsonPath('data.tenant_id', $tenant->id)
            ->assertJsonPath('data.role', UserRole::SuperAdmin->value);

        $logoutResponse = $this->withCookie('XSRF-TOKEN', $token)
            ->withSession(['_token' => $token])
            ->postJson('/api/v1/auth/logout', [], [
                'X-Tenant-ID' => 'nike',
                'X-CSRF-TOKEN' => $token,
                'X-XSRF-TOKEN' => $token,
            ]);

        $logoutResponse
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');

        $this->assertGuest();
    }

    #[Test]
    public function test_can_fetch_current_tenant_metadata(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Nike Logistics',
            'slug' => 'nike',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/tenants/current', ['X-Tenant-ID' => 'nike']);

        $response
            ->assertOk()
            ->assertJsonPath('data.id', $tenant->id)
            ->assertJsonPath('data.slug', 'nike')
            ->assertJsonPath('data.name', 'Nike Logistics');

        $response->assertJsonStructure([
            'data' => [
                'id',
                'slug',
                'name',
            ],
        ]);
    }

    #[Test]
    public function test_broadcast_user_resolution_middleware(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Nike Logistics',
            'slug' => 'nike',
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::SuperAdmin,
            'email' => 'broadcast@nike.com',
            'password' => Hash::make('Password123!'),
        ]);

        $token = 'test-token';

        $this->withCookie('XSRF-TOKEN', $token)
            ->withSession(['_token' => $token])
            ->postJson('/api/v1/auth/login', [
                'email' => 'broadcast@nike.com',
                'password' => 'Password123!',
            ], [
                'X-Tenant-ID' => 'nike',
                'X-CSRF-TOKEN' => $token,
                'X-XSRF-TOKEN' => $token,
            ])
            ->assertOk();

        $response = $this->withCookie('XSRF-TOKEN', $token)
            ->withSession(['_token' => $token])
            ->postJson('/broadcasting/auth', [
                'socket_id' => '123.456',
                'channel_name' => 'tenant.' . $tenant->id . '.ops',
            ], [
                'X-Tenant-ID' => 'nike',
                'X-CSRF-TOKEN' => $token,
                'X-XSRF-TOKEN' => $token,
            ]);

        $response->assertOk();
        $response->assertJsonStructure(['auth']);
        $this->assertNotSame('', (string) $response->json('auth'));
        $this->assertSame($tenant->id, (int) $user->fresh()->tenant_id);
    }
}
