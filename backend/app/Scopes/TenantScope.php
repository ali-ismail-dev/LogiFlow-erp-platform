<?php

declare(strict_types=1);

namespace App\Scopes;

use App\Exceptions\TenantContextNotResolvedException;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

final class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $tenantManager = app(TenantManager::class);

        if (! $tenantManager->check()) {
            throw TenantContextNotResolvedException::forModel($model::class);
        }

        $builder->where($model->qualifyColumn('tenant_id'), '=', $tenantManager->id);
    }
}
