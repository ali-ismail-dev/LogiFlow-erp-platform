<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\OrderStatus;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'warehouse_id',
        'order_number',
        'customer_name',
        'shipping_address',
        'status',
        'total_weight_kg',
        'promised_at',
    ];

    protected function casts(): array
    {
        return [
            'shipping_address' => 'array',
            'status' => OrderStatus::class,
            'total_weight_kg' => 'decimal:2',
            'promised_at' => 'immutable_datetime',
        ];
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function stops(): HasMany
    {
        return $this->hasMany(Stop::class)->latest();
    }
}
