<?php

declare(strict_types=1);

namespace App\Traits;

use App\Exceptions\TenantContextNotResolvedException;
use App\Models\Tenant;
use App\Scopes\TenantScope;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @mixin Model
 * @method static void addGlobalScope($scope, $implementation = null)
 * @method static void creating(\Closure $callback)
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope());

        static::creating(function (Model $model): void {
            if (! is_null($model->getAttribute('tenant_id'))) {
                return;
            }

            $tenantManager = app(TenantManager::class);

            if (! $tenantManager->check()) {
                throw TenantContextNotResolvedException::forModel($model::class);
            }

            $model->setAttribute('tenant_id', $tenantManager->id);
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function scopeWithoutTenancy(Builder $query): Builder
    {
        return $query->withoutGlobalScope(TenantScope::class);
    }
}
