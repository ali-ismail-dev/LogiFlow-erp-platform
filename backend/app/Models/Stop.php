<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\StopStatus;
use App\Traits\BelongsToTenant;
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
            'status' => StopStatus::class,
            'sequence' => 'integer',
            'eta' => 'immutable_datetime',
            'arrived_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
        ];
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
