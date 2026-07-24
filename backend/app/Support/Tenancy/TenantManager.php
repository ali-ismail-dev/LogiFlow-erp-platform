<?php

declare(strict_types=1);

namespace App\Support\Tenancy;

use App\Models\Tenant;

final class TenantManager
{
    public private(set) ?Tenant $tenant = null;

    public ?int $id {
        get => $this->tenant?->id;
    }

    public function resolve(Tenant $tenant): void
    {
        $this->tenant = $tenant;
    }

    public function forget(): void
    {
        $this->tenant = null;
    }

    public function check(): bool
    {
        return $this->tenant !== null;
    }

    /**
     * Set the tenant context directly using a raw numeric or string identifier.
     * Crucial for CLI background workers/queues where no HTTP request exists.
     */
    public function setTenantId(int|string|null $id): void
    {
        if (is_null($id)) {
            $this->forget();
            return;
        }

        // Resolves or mocks a temporary tenant container instance for scope checks
        $tenant = new \App\Models\Tenant();
        $tenant->id = (int) $id;
        $this->resolve($tenant);
    }

    /**
     * Explicit wipe-out loop to satisfy the queue worker process isolation pattern.
     */
    public function clear(): void
    {
        $this->forget();
    }
}
