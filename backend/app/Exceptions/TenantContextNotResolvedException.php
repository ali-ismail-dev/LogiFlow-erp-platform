<?php

declare(strict_types=1);

namespace App\Exceptions;

final class TenantContextNotResolvedException extends DomainException
{
    public static function forModel(string $modelClass): self
    {
        return new self(
            "Attempted to query or create [{$modelClass}] without a resolved tenant context. ".
            "If this is intentional system-level code, call {$modelClass}::withoutTenancy() explicitly.",
        );
    }
}
