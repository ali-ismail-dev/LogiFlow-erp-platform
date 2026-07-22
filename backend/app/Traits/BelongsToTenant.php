<?php

declare(strict_types=1);

namespace App\Traits;

use App\Scopes\TenantScope;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Model;
use LogicException;

/**
 * Automatically applies row-level tenant isolation to Eloquent models.
 *
 * Any model using this trait MUST contain a nullable or non-nullable
 * `tenant_id` column. The global scope transparently filters queries,
 * while the creating hook guarantees that every persisted record is
 * associated with the active tenant.
 *
 * Administrative or infrastructure code may bypass the scope using
 * Laravel's native APIs:
 *
 * Model::withoutGlobalScope(TenantScope::class)
 * Model::withoutGlobalScopes()
 *
 * @method static void addGlobalScope(\Illuminate\Database\Eloquent\Scope $scope)
 * @method static void creating(\Closure $callback)
 * @mixin Model
 */
trait BelongsToTenant
{
    /**
     * Boot the trait.
     */
    public static function bootBelongsToTenant(): void
    {
        /*
         * Resolve through the container instead of constructing directly.
         * This allows TenantScope to receive its dependencies through
         * Laravel's IoC container.
         */
        static::addGlobalScope(
            app(TenantScope::class),
        );

        static::creating(
            static function (Model $model): void {
                /** @var TenantManager $tenantManager */
                $tenantManager = app(TenantManager::class);

                /*
                 * Writing tenant-owned data without an active tenant
                 * context represents an infrastructure failure and
                 * could compromise data isolation.
                 */
                if (! $tenantManager->hasTenant()) {
                    throw new LogicException(sprintf(
                        'Attempted to create [%s] without an active tenant context.',
                        $model::class,
                    ));
                }

                $tenantId = $tenantManager->tenantId();

                if ($tenantId === null) {
                    throw new LogicException(sprintf(
                        'Active tenant context for [%s] does not contain a valid tenant identifier.',
                        $model::class,
                    ));
                }

                /*
                 * Prevent callers from forging tenant ownership.
                 *
                 * The infrastructure layer is the single source of truth
                 * for tenant assignment. Any manually supplied tenant_id
                 * is ignored and overwritten.
                 */
                $model->setAttribute(
                    'tenant_id',
                    $tenantId,
                );
            },
        );
    }
}
