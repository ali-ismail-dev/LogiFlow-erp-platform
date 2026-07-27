<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Logistics\CarrierShipmentStatus;
use App\Enums\StopStatus;
use App\Traits\BelongsToTenant;
use BackedEnum;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Stop extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'dispatch_id',
        'order_id',
        'sequence',
        'destination_address',
        'label',
        'status',
        'eta',
        'arrived_at',
        'completed_at',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'destination_address' => 'array',
            'sequence' => 'integer',
            'eta' => 'immutable_datetime',
            'arrived_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
        ];
    }

    /**
     * Accessor: try StopStatus first, then CarrierShipmentStatus, then raw string.
     */
    public function getStatusAttribute(mixed $value): StopStatus|CarrierShipmentStatus|string|null
    {
        if ($value === null) {
            return null;
        }

        if ($enum = StopStatus::tryFrom((string) $value)) {
            return $enum;
        }

        if ($enum = CarrierShipmentStatus::tryFrom((string) $value)) {
            return $enum;
        }

        return (string) $value;
    }

    /**
     * Mutator: accept a BackedEnum instance or a string, normalise to string.
     */
    public function setStatusAttribute(mixed $value): void
    {
        $this->attributes['status'] = $value instanceof BackedEnum ? $value->value : (string) $value;
    }

    public function dispatch(): BelongsTo
    {
        return $this->belongsTo(Dispatch::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
