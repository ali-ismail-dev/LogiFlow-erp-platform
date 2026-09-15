<?php

declare(strict_types=1);

namespace App\Services\Ai\Tools;

use App\Contracts\AiToolInterface;
use App\Models\Driver;

/**
 * Reports telemetry availability for tenant drivers.
 *
 * LogiFlow does not currently persist driver GPS pings or Reverb presence
 * records, so this tool reports telemetry as unavailable until that storage is
 * added. It does not infer a signal from unrelated dispatch timestamps.
 */
class GetTelemetrySummaryTool implements AiToolInterface
{
    private const int STALE_THRESHOLD_MINUTES = 30;

    public function getName(): string
    {
        return 'get_telemetry_summary';
    }

    public function getDescription(): string
    {
        return 'Gets recent driver GPS updates, active Reverb WebSocket connection signals, '
            . 'and signal loss warnings. Driver telemetry persistence is not configured yet, '
            . 'so unavailable telemetry is reported explicitly.';
    }

    public function getParameterSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'driver_id' => [
                    'type' => 'integer',
                    'description' => 'Restrict the summary to a single driver.',
                ],
            ],
            'required' => [],
        ];
    }

    public function execute(array $arguments, int $tenantId): array
    {
        $driverId = $this->sanitizeInt($arguments['driver_id'] ?? null);

        $drivers = Driver::withoutTenancy()
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->when($driverId !== null, fn($query) => $query->whereKey($driverId))
            ->with(['user' => function ($query) use ($tenantId): void {
                $query
                    ->withoutTenancy()
                    ->where('tenant_id', $tenantId);
            }])
            ->orderBy('id')
            ->get()
            ->map(fn(Driver $driver): array => [
                'driver_id' => $driver->id,
                'driver_name' => $driver->user?->name,
                'last_ping_at' => null,
                'minutes_since_ping' => null,
                'signal_status' => 'unavailable',
            ])
            ->values()
            ->all();

        return [
            'stale_threshold_minutes' => self::STALE_THRESHOLD_MINUTES,
            'telemetry_source' => 'not_configured',
            'drivers' => $drivers,
        ];
    }

    private function sanitizeInt(mixed $value): ?int
    {
        if (is_int($value) && $value > 0) {
            return $value;
        }

        if (is_string($value) && $value !== '' && ctype_digit($value)) {
            $driverId = (int) $value;

            return $driverId > 0 ? $driverId : null;
        }

        return null;
    }
}
