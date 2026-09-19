<?php

declare(strict_types=1);

namespace Tests\Feature\Policies;

use App\Enums\UserRole;
use App\Models\Dispatch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class DispatchPolicyTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function super_admins_can_manage_dispatches_without_further_checks(): void
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::SuperAdmin,
        ]);

        $this->assertTrue(Gate::forUser($user)->allows('viewAny', Dispatch::class));
        $this->assertTrue(Gate::forUser($user)->allows('create', Dispatch::class));
    }

    #[Test]
    public function dispatchers_and_warehouse_managers_can_view_dispatches(): void
    {
        $tenant = Tenant::factory()->create();

        $dispatcher = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Dispatcher,
        ]);

        $warehouseManager = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::WarehouseManager,
        ]);

        $driver = User::factory()->create([
            'tenant_id' => $tenant->id,
            'role' => UserRole::Driver,
        ]);

        $this->assertTrue(Gate::forUser($dispatcher)->allows('viewAny', Dispatch::class));
        $this->assertTrue(Gate::forUser($warehouseManager)->allows('viewAny', Dispatch::class));
        $this->assertFalse(Gate::forUser($driver)->allows('viewAny', Dispatch::class));
        $this->assertFalse(Gate::forUser($driver)->allows('create', Dispatch::class));
    }
}
