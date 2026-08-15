<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DispatchStatus;
use App\Enums\Logistics\CarrierShipmentStatus;
use App\Support\Tenancy\TenantManager;
use App\Traits\BelongsToTenant;
use BackedEnum;
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
        'manifest_path',
        'ledger_status',
        'ledger_error',
        'ledger_failed_at',
        'carrier_waybill_reference',
        'scheduled_at',
        'departed_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'immutable_datetime',
            'departed_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $model): void {
            if (! is_null($model->getAttribute('warehouse_id'))) {
                return;
            }

            $tenantId = $model->getAttribute('tenant_id');

            if (is_null($tenantId)) {
                $tenantManager = app(TenantManager::class);

                if (! $tenantManager->check()) {
                    return;
                }

                $tenantId = $tenantManager->id;
            }

            if (is_null($tenantId)) {
                return;
            }

            $warehouse = Warehouse::withoutTenancy()
                ->where('tenant_id', $tenantId)
                ->first();

            if ($warehouse === null) {
                $warehouse = Warehouse::factory()->create([
                    'tenant_id' => $tenantId,
                ]);
            }

            $model->setAttribute('warehouse_id', $warehouse->id);
        });
    }

    public function getStatusAttribute(mixed $value): DispatchStatus|CarrierShipmentStatus|string|null
    {
        if ($value === null) {
            return null;
        }

        if ($enum = DispatchStatus::tryFrom((string) $value)) {
            return $enum;
        }

        if ($enum = CarrierShipmentStatus::tryFrom((string) $value)) {
            return $enum;
        }

        return (string) $value;
    }

    public function setStatusAttribute(mixed $value): void
    {
        $this->attributes['status'] = $value instanceof BackedEnum ? $value->value : (string) $value;
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
     * Get the multiple client order records bundled onto this route manifest run.
     *
     * @return HasMany
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * Relational helper for active stop sequencing tracking metrics.
     *
     * Uses withoutTenancy() to remain safe in contexts where no tenant
     * middleware is active (e.g. inbound carrier webhooks).
     */
    public function getCurrentStopAttribute(): ?Stop
    {
        return $this->stops()
            ->withoutTenancy()
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
