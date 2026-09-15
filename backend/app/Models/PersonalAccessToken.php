<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\MorphTo;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

final class PersonalAccessToken extends SanctumPersonalAccessToken
{
    public function tokenable(): MorphTo
    {
        // The RSC service principal has tenant_id = null, so the tenant
        // scope would filter it out during token resolution. Bypass the
        // scope here; tenant authorization is enforced separately by
        // TenantBoundaryMiddleware.
        return $this->morphTo('tokenable')->withoutGlobalScopes();
    }
}
