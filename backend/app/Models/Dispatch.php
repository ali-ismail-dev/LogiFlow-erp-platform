<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DispatchStatus;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Dispatch extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'warehouse_id',
        'reference_code',
        'driver_name',
        'vehicle_identifier',
        'status',
        'scheduled_at',
        'departed_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => DispatchStatus::class,
            'scheduled_at' => 'immutable_datetime',
            'departed_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
        ];
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function stops(): HasMany
    {
        return $this->hasMany(Stop::class)->orderBy('sequence');
    }

    /**
     * Relational helper for active stop sequencing tracking metrics.
     */
    public function getCurrentStopAttribute(): ?Stop
    {
        return $this->stops()
            ->whereNotIn('status', [\App\Enums\StopStatus::Completed, \App\Enums\StopStatus::Failed])
            ->orderBy('sequence', 'asc')
            ->first();
    }

    /**
     * Operational helper mapping to fit driver identity array contracts.
     */
    public function getDriverAttribute(): ?object
    {
        if (is_null($this->driver_name)) return null;
        return (object) [
            'id' => $this->id,
            'name' => $this->driver_name
        ];
    }
}

// FIX: Declare the structural class alias AFTER the class token loop closes completely
class_alias(Dispatch::class, 'App\Models\DispatchTrip');
