<?php

declare(strict_types=1);

namespace App\Services\Ai\Tools;

use App\Contracts\AiToolInterface;
use App\Models\Stop;
use Illuminate\Support\Carbon;

/**
 * Finds active stops whose ETA has passed or whose parent dispatch is delayed.
 * All stop and dispatch queries are explicitly constrained to the requested tenant.
 */
class FindAtRiskStopsTool implements AiToolInterface
{
    private const int DEFAULT_LIMIT = 10;
    private const int MAX_LIMIT = 20;
    private const int CANDIDATE_FETCH_CAP = 100;
    private const int HIGH_SEVERITY_DELAY_MINUTES = 60;

    public function getName(): string
    {
        return 'find_at_risk_stops';
    }

    public function getDescription(): string
    {
        return 'Finds delivery or pickup stops at risk of missing SLAs due to delays, '
            . 'missing driver telemetry, or excessive pending time.';
    }

    public function getParameterSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'warehouse_id' => [
                    'type' => 'integer',
                    'description' => 'Restrict results to stops assigned to this dispatch warehouse.',
                ],
                'severity' => [
                    'type' => 'string',
                    'enum' => ['high', 'medium', 'all'],
                    'description' => 'Filter by risk severity. Defaults to "all".',
                ],
                'limit' => [
                    'type' => 'integer',
                    'description' => 'Maximum number of stops to return (max 20). Defaults to 10.',
                ],
            ],
            'required' => [],
        ];
    }

    public function execute(array $arguments, int $tenantId): array
    {
        $warehouseId = $this->sanitizeInt($arguments['warehouse_id'] ?? null);
        $severityFilter = $this->sanitizeSeverity($arguments['severity'] ?? 'all');
        $limit = $this->sanitizeLimit($arguments['limit'] ?? self::DEFAULT_LIMIT);
        $now = Carbon::now();

        $query = Stop::withoutTenancy()
            ->where('tenant_id', $tenantId)
            ->whereNotIn('status', ['completed', 'failed'])
            ->where(function ($riskQuery) use ($tenantId, $now): void {
                $riskQuery
                    ->where(function ($overdue) use ($now): void {
                        $overdue
                            ->whereNotNull('eta')
                            ->where('eta', '<', $now);
                    })
                    ->orWhereHas('dispatch', function ($dispatchQuery) use ($tenantId): void {
                        $dispatchQuery
                            ->withoutTenancy()
                            ->where('tenant_id', $tenantId)
                            ->where('status', 'delayed');
                    });
            })
            ->with(['dispatch' => function ($dispatchQuery) use ($tenantId): void {
                $dispatchQuery
                    ->withoutTenancy()
                    ->where('tenant_id', $tenantId);
            }]);

        if ($warehouseId !== null) {
            $query->whereHas('dispatch', function ($dispatchQuery) use ($tenantId, $warehouseId): void {
                $dispatchQuery
                    ->withoutTenancy()
                    ->where('tenant_id', $tenantId)
                    ->where('warehouse_id', $warehouseId);
            });
        }

        $candidates = $query
            ->orderBy('eta')
            ->limit(self::CANDIDATE_FETCH_CAP)
            ->get();

        $results = [];

        foreach ($candidates as $stop) {
            $scheduledAt = $stop->eta;
            $isOverdue = $scheduledAt !== null && $now->greaterThan($scheduledAt);
            $delayMinutes = $isOverdue ? (int) $scheduledAt->diffInMinutes($now) : 0;
            $dispatchDelayed = $stop->dispatch?->getRawOriginal('status') === 'delayed';
            $severity = $delayMinutes >= self::HIGH_SEVERITY_DELAY_MINUTES ? 'high' : 'medium';

            if ($severityFilter !== 'all' && $severityFilter !== $severity) {
                continue;
            }

            $reason = match (true) {
                $isOverdue && $dispatchDelayed => "ETA passed by {$delayMinutes} min and parent dispatch is flagged delayed",
                $isOverdue => "ETA passed by {$delayMinutes} min",
                $dispatchDelayed => 'Parent dispatch is flagged as delayed',
                default => 'Flagged as at risk',
            };

            $results[] = [
                'stop_id' => $stop->id,
                'dispatch_reference' => $stop->dispatch?->reference_code,
                'warehouse_id' => $stop->dispatch?->warehouse_id,
                'delay_minutes' => $delayMinutes,
                'reason' => $reason,
            ];

            if (count($results) >= $limit) {
                break;
            }
        }

        return $results;
    }

    private function sanitizeInt(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_string($value) && $value !== '' && ctype_digit(ltrim($value, '-'))) {
            return (int) $value;
        }

        return null;
    }

    private function sanitizeLimit(mixed $value): int
    {
        $limit = $this->sanitizeInt($value) ?? self::DEFAULT_LIMIT;

        return max(1, min(self::MAX_LIMIT, $limit));
    }

    private function sanitizeSeverity(mixed $value): string
    {
        $severity = is_string($value) ? strtolower($value) : 'all';

        return in_array($severity, ['high', 'medium', 'all'], true) ? $severity : 'all';
    }
}
