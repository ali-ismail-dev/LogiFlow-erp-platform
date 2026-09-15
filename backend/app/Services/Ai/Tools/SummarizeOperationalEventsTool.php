<?php

declare(strict_types=1);

namespace App\Services\Ai\Tools;

use App\Contracts\AiToolInterface;
use App\Models\Dispatch;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Summarizes recent dispatch status activity available in LogiFlow.
 *
 * LogiFlow does not currently have a dispatch-events model or history table,
 * so this tool uses dispatch updated timestamps and carrier status timestamps
 * as the available operational activity source.
 */
class SummarizeOperationalEventsTool implements AiToolInterface
{
    private const int DEFAULT_HOURS = 24;
    private const int MAX_HOURS = 72;
    private const int MAX_EXCEPTIONS_RETURNED = 15;

    /** @var array<int, string> */
    private const array EXCEPTION_STATUSES = ['cancelled', 'delivery_failed'];

    public function getName(): string
    {
        return 'summarize_operational_events';
    }

    public function getDescription(): string
    {
        return 'Summarizes recent dispatch status activity and exceptions within a given timeframe. '
            . 'The summary is based on dispatch and carrier status timestamps available in LogiFlow.';
    }

    public function getParameterSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'hours' => [
                    'type' => 'integer',
                    'description' => 'Lookback window in hours (max 72). Defaults to 24.',
                ],
            ],
            'required' => [],
        ];
    }

    public function execute(array $arguments, int $tenantId): array
    {
        $hours = $this->sanitizeHours($arguments['hours'] ?? self::DEFAULT_HOURS);
        $since = Carbon::now()->subHours($hours);

        $dispatches = Dispatch::withoutTenancy()
            ->where('tenant_id', $tenantId)
            ->where(function ($query) use ($since): void {
                $query
                    ->where('updated_at', '>=', $since)
                    ->orWhere('carrier_status_timestamp', '>=', $since);
            })
            ->orderByDesc('updated_at')
            ->get();

        $completedDispatches = $dispatches
            ->filter(fn(Dispatch $dispatch): bool => $dispatch->getRawOriginal('status') === 'completed')
            ->count();

        $cancelledDispatches = $dispatches
            ->filter(fn(Dispatch $dispatch): bool => $dispatch->getRawOriginal('status') === 'cancelled')
            ->count();

        $exceptions = $dispatches
            ->filter(fn(Dispatch $dispatch): bool => in_array(
                $dispatch->getRawOriginal('status'),
                self::EXCEPTION_STATUSES,
                true,
            ))
            ->take(self::MAX_EXCEPTIONS_RETURNED)
            ->map(fn(Dispatch $dispatch): array => [
                'dispatch_id' => $dispatch->reference_code,
                'type' => $dispatch->getRawOriginal('status'),
                'message' => $this->exceptionMessage($dispatch),
                'occurred_at' => $this->activityTimestamp($dispatch)?->toIso8601String(),
            ])
            ->values()
            ->all();

        return [
            'window_hours' => $hours,
            'completed_dispatches' => $completedDispatches,
            'delayed_dispatches' => 0,
            'cancelled_dispatches' => $cancelledDispatches,
            'exceptions' => $exceptions,
        ];
    }

    private function activityTimestamp(Dispatch $dispatch): ?CarbonInterface
    {
        $carrierTimestamp = $dispatch->carrier_status_timestamp;

        if ($carrierTimestamp !== null) {
            return $carrierTimestamp;
        }

        return $dispatch->updated_at;
    }

    private function exceptionMessage(Dispatch $dispatch): string
    {
        $status = $dispatch->getRawOriginal('status');

        return match ($status) {
            'delivery_failed' => 'Carrier reported delivery failure for this dispatch',
            'cancelled' => 'Dispatch was cancelled',
            default => 'Dispatch requires operational attention',
        };
    }

    private function sanitizeHours(mixed $value): int
    {
        $hours = is_int($value)
            ? $value
            : (is_string($value) && ctype_digit($value) ? (int) $value : self::DEFAULT_HOURS);

        return max(1, min(self::MAX_HOURS, $hours));
    }
}
