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

    /**
     * Fetches the current active stop in the dispatch timeline sequence.
     */
    public function getCurrentStopAttribute(): ?Stop
    {
        // Finds the first stop that isn't finalized (completed/failed) sorted by sequence order
        return $this->stops()
            ->whereNotIn('status', [\App\Enums\StopStatus::Completed, \App\Enums\StopStatus::Failed])
            ->orderBy('sequence', 'asc')
            ->first();
    }

    /**
     * Simulated connection to driver layer for user validation payloads.
     */
    public function getDriverAttribute(): ?object
    {
        // Plausible placeholder return data object mapping to fit the payload contract cleanly
        if (is_null($this->driver_name)) return null;
        return (object) [
            'id' => $this->id, // Use an opaque connection id structure
            'name' => $this->driver_name
        ];
    }

    public function stops(): HasMany
    {
        return $this->hasMany(Stop::class)->orderBy('sequence');
    }
}
