<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DriverStatus;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Driver — a logistics-specific profile extension mapping a user whose
 * role evaluates as a driver onto operational fleet metadata.
 *
 * The BelongsToTenant trait installs the global TenantScope firewall so that
 * every read and write automatically scopes to the active tenant context.
 */
class Driver extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'license_number',
        'phone_number',
        'status',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => DriverStatus::class,
        ];
    }

    /**
     * The underlying login/auth user this driver profile extends.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The owning tenant workspace for this driver profile.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
