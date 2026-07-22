<?php

declare(strict_types=1);

namespace App\Scopes;

use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

final readonly class TenantScope implements Scope
{
    public function __construct(
        private TenantManager $tenantManager,
    ) {}

    /**
     * Apply the tenant isolation constraint.
     *
     * This scope is intentionally passive:
     *
     * - If a tenant context exists, every query is constrained to that tenant.
     * - If no tenant context exists (CLI, migrations, seeders, central
     *   administration, etc.), the scope does nothing.
     *
     * Administrative operations can explicitly opt out via:
     *
     * Model::withoutGlobalScope(TenantScope::class)
     * Model::withoutGlobalScopes()
     */
    public function apply(Builder $builder, Model $model): void
    {
        if (! $this->tenantManager->hasTenant()) {
            return;
        }

        $tenantId = $this->tenantManager->tenantId();

        if ($tenantId === null) {
            return;
        }

        $builder->where(
            $model->qualifyColumn('tenant_id'),
            '=',
            $tenantId,
        );
    }
}
