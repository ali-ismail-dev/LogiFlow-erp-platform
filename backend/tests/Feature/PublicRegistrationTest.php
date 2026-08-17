<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PublicRegistrationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function public_registration_creates_a_tenant_and_super_admin_user_in_a_single_transaction(): void
    {
        $response = $this->postJson('/api/v1/public/register', [
            'company_name' => 'Acme Logistics',
            'admin_name' => 'Jane Cooper',
            'admin_email' => 'jane@acme-logistics.com',
            'password' => 'supersecret123',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.tenant.slug', 'acme-logistics');

        $this->assertDatabaseHas('tenants', [
            'name' => 'Acme Logistics',
            'slug' => 'acme-logistics',
        ]);

        $tenant = Tenant::where('slug', 'acme-logistics')->firstOrFail();

        $this->assertDatabaseHas('warehouses', [
            'tenant_id' => $tenant->id,
            'name' => 'Acme Logistics Central Hub',
        ]);

        $this->assertDatabaseHas('users', [
            'tenant_id' => $tenant->id,
            'name' => 'Jane Cooper',
            'email' => 'jane@acme-logistics.com',
            'role' => 'super_admin',
        ]);

        $user = User::withoutTenancy()->where('email', 'jane@acme-logistics.com')->firstOrFail();
        $this->assertTrue(password_verify('supersecret123', $user->password));
    }
}
