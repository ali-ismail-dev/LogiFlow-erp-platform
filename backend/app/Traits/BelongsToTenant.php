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
 * @method static void updating(\Closure $callback)
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope());

        static::creating(function (Model $model): void {
            $tenantManager = app(TenantManager::class);

            if (! $tenantManager->check()) {
                throw TenantContextNotResolvedException::forModel($model::class);
            }

            $model->setAttribute('tenant_id', $tenantManager->id);
        });

        // Reject any attempt to move an existing row to another tenant.
        // tenant_id is set once at creation and is immutable thereafter.
        static::updating(function (Model $model): void {
            if ($model->isDirty('tenant_id')) {
                throw new \RuntimeException('Cannot change tenant_id on ' . $model::class . '. Moveing the record between tenants is not a supported operation. If this is a legitimate system-level migration, delete and recreate the record, or use the appropriate admin tooling.');
            }
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
