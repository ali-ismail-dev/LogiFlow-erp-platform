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
}
