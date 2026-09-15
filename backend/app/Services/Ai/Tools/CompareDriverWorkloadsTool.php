<?php

declare(strict_types=1);

namespace App\Services\Ai\Tools;

use App\Contracts\AiToolInterface;
use App\Models\Driver;
use Illuminate\Database\Query\JoinClause;

/**
 * Compares active driver workloads using the dispatches and stops assigned to
 * each driver's tenant-scoped user name.
 */
class CompareDriverWorkloadsTool implements AiToolInterface
{
    private const int DEFAULT_LIMIT = 10;
    private const int MAX_LIMIT = 50;
    private const float OVERLOADED_RATIO = 1.2;
    private const float UNDERUTILIZED_RATIO = 0.8;

    /** @var array<int, string> */
    private const array ACTIVE_DISPATCH_STATUSES = [
        'planned',
        'in_transit',
        'picked_up',
        'out_for_delivery',
        'unknown',
    ];

    /** @var array<int, string> */
    private const array INACTIVE_STOP_STATUSES = ['completed', 'failed'];

    public function getName(): string
    {
        return 'compare_driver_workloads';
    }

    public function getDescription(): string
    {
        return 'Compares active order assignments, stop counts, and shift durations across '
            . 'active fleet drivers to spot imbalances.';
    }

    public function getParameterSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'limit' => [
                    'type' => 'integer',
                    'description' => 'Maximum number of drivers to return. Defaults to 10.',
                ],
            ],
            'required' => [],
        ];
    }

    public function execute(array $arguments, int $tenantId): array
    {
        $limit = $this->sanitizeLimit($arguments['limit'] ?? self::DEFAULT_LIMIT);

        $drivers = Driver::withoutTenancy()
            ->join('users', function (JoinClause $join): void {
                $join
                    ->on('users.id', '=', 'drivers.user_id')
                    ->whereColumn('users.tenant_id', 'drivers.tenant_id');
            })
            ->leftJoin('dispatches', function (JoinClause $join): void {
                $join
                    ->on('dispatches.driver_name', '=', 'users.name')
                    ->on('dispatches.tenant_id', '=', 'drivers.tenant_id')
                    ->whereIn('dispatches.status', self::ACTIVE_DISPATCH_STATUSES);
            })
            ->leftJoin('stops', function (JoinClause $join): void {
                $join
                    ->on('stops.dispatch_id', '=', 'dispatches.id')
                    ->on('stops.tenant_id', '=', 'drivers.tenant_id')
                    ->whereNotIn('stops.status', self::INACTIVE_STOP_STATUSES);
            })
            ->where('drivers.tenant_id', $tenantId)
            ->where('drivers.status', 'active')
            ->select('drivers.id as driver_id', 'users.name')
            ->selectRaw('COUNT(DISTINCT dispatches.id) as active_dispatches_count')
            ->selectRaw('COUNT(stops.id) as assigned_stops_count')
            ->groupBy('drivers.id', 'users.name')
            ->orderByDesc('assigned_stops_count')
            ->limit($limit)
            ->get();

        if ($drivers->isEmpty()) {
            return [];
        }

        $averageLoad = (float) $drivers->avg('assigned_stops_count');

        return $drivers->map(fn(object $driver): array => [
            'driver_id' => (int) $driver->driver_id,
            'name' => $driver->name,
            'active_dispatches_count' => (int) $driver->active_dispatches_count,
            'assigned_stops_count' => (int) $driver->assigned_stops_count,
            'workload_status' => $this->classifyWorkload((int) $driver->assigned_stops_count, $averageLoad),
        ])->values()->all();
    }

    private function classifyWorkload(int $assignedStops, float $averageLoad): string
    {
        if ($averageLoad <= 0.0) {
            return 'balanced';
        }

        $ratio = $assignedStops / $averageLoad;

        return match (true) {
            $ratio >= self::OVERLOADED_RATIO => 'overloaded',
            $ratio <= self::UNDERUTILIZED_RATIO => 'underutilized',
            default => 'balanced',
        };
    }

    private function sanitizeLimit(mixed $value): int
    {
        $limit = is_int($value)
            ? $value
            : (is_string($value) && ctype_digit($value) ? (int) $value : self::DEFAULT_LIMIT);

        return max(1, min(self::MAX_LIMIT, $limit));
    }
}
