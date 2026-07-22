<?php

declare(strict_types=1);

namespace App\Support\Tenancy;

use App\Models\Tenant;
use LogicException;

/**
 * TenantManager
 *
 * Request-scoped tenant context used throughout the application.
 *
 * This class intentionally contains no business logic. Its sole responsibility
 * is maintaining the active tenant for the current request lifecycle.
 *
 * Registered as a singleton by the TenancyServiceProvider.
 */
final class TenantManager
{
    /**
     * The active tenant for the current request.
     */
    private ?Tenant $tenant = null;

    /**
     * Register the active tenant.
     *
     * Once a tenant has been registered for the current request, replacing it
     * is considered a programming error because it would break row-level
     * isolation guarantees.
     *
     * @throws LogicException
     */
    public function setTenant(Tenant $tenant): void
    {
        if ($this->tenant !== null && $this->tenant->isNot($tenant)) {
            throw new LogicException(
                sprintf(
                    'Tenant context is already initialized (%s) and cannot be replaced with (%s) during the same request.',
                    $this->tenant->getKey(),
                    $tenant->getKey(),
                ),
            );
        }

        $this->tenant = $tenant;
    }

    /**
     * Determine whether a tenant has been resolved.
     */
    public function hasTenant(): bool
    {
        return $this->tenant !== null;
    }

    /**
     * Return the current tenant.
     */
    public function tenant(): ?Tenant
    {
        return $this->tenant;
    }

    /**
     * Alias for tenant().
     */
    public function getTenant(): ?Tenant
    {
        return $this->tenant();
    }

    /**
     * Return the active tenant identifier.
     *
     * @return int|string|null
     */
    public function tenantId(): int|string|null
    {
        return $this->tenant?->getKey();
    }

    /**
     * Alias for tenantId().
     *
     * @return int|string|null
     */
    public function getTenantId(): int|string|null
    {
        return $this->tenantId();
    }

    /**
     * Require an active tenant.
     *
     * Useful for infrastructure code (global scopes, services, etc.)
     * where a tenant is expected to exist.
     *
     * @throws LogicException
     */
    public function requireTenant(): Tenant
    {
        return $this->tenant
            ?? throw new LogicException(
                'No tenant context has been initialized for the current request.'
            );
    }

    /**
     * Remove the tenant context.
     *
     * Primarily intended for testing or long-running workers.
     */
    public function forgetTenant(): void
    {
        $this->tenant = null;
    }
}
