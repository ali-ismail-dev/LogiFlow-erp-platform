<?php

declare(strict_types=1);

namespace Tests\Unit\Scopes;

use App\Exceptions\TenantContextNotResolvedException;
use App\Models\Dispatch;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TenantScopeTest extends TestCase
{
    use RefreshDatabase;

    private TenantManager $tenantManager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantManager = $this->app->make(TenantManager::class);
        $this->tenantManager->clear();
    }

    #[Test]
    public function it_throws_exception_when_tenant_context_is_not_resolved(): void
    {
        $this->expectException(TenantContextNotResolvedException::class);

        Dispatch::query()->get();
    }

    #[Test]
    public function it_applies_tenant_id_constraint_when_tenant_is_resolved(): void
    {
        $tenant = Tenant::factory()->create();
        $this->tenantManager->resolve($tenant);

        $builder = Dispatch::query();

        $this->assertStringContainsString('"tenant_id" = ?', $builder->toSql());
        $this->assertEquals([$tenant->id], $builder->getBindings());
    }
}
