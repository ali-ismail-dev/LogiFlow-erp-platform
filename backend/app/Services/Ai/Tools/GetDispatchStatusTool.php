<?php

declare(strict_types=1);

namespace App\Services\Ai\Tools;

use App\Contracts\AiToolInterface;
use App\Models\Dispatch;

/**
 * Retrieves tenant-scoped operational details and stop progress for a dispatch.
 */
class GetDispatchStatusTool implements AiToolInterface
{
    public function getName(): string
    {
        return 'get_dispatch_status';
    }

    public function getDescription(): string
    {
        return 'Retrieves complete operational details, stop progress, and driver status '
            . 'for a specific dispatch reference or ID.';
    }

    public function getParameterSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'dispatch_id' => [
                    'type' => ['string', 'integer'],
                    'description' => 'The dispatch reference (e.g. "DSP-1042") or numeric dispatch ID.',
                ],
            ],
            'required' => ['dispatch_id'],
        ];
    }

    public function execute(array $arguments, int $tenantId): array
    {
        $identifier = $this->sanitizeIdentifier($arguments['dispatch_id'] ?? null);

        if ($identifier === null) {
            return ['error' => 'Dispatch not found or access denied'];
        }

        $dispatch = Dispatch::withoutTenancy()
            ->where('tenant_id', $tenantId)
            ->where(function ($query) use ($identifier): void {
                $query->where('reference_code', $identifier);

                if (ctype_digit($identifier)) {
                    $query->orWhere('id', (int) $identifier);
                }
            })
            ->with(['stops' => function ($query) use ($tenantId): void {
                $query
                    ->withoutTenancy()
                    ->where('tenant_id', $tenantId);
            }])
            ->first();

        if ($dispatch === null) {
            return ['error' => 'Dispatch not found or access denied'];
        }

        $totalStops = $dispatch->stops->count();
        $completedStops = $dispatch->stops
            ->filter(fn($stop): bool => $stop->getRawOriginal('status') === 'completed')
            ->count();

        return [
            'dispatch_id' => $dispatch->reference_code,
            'status' => $dispatch->getRawOriginal('status'),
            'driver' => $dispatch->driver_name !== null ? [
                'name' => $dispatch->driver_name,
            ] : null,
            'assigned_vehicle' => $dispatch->vehicle_identifier,
            'total_stops' => $totalStops,
            'completed_stops' => $completedStops,
            'pending_stops' => $totalStops - $completedStops,
            'created_at' => $dispatch->created_at?->toIso8601String(),
        ];
    }

    private function sanitizeIdentifier(mixed $value): ?string
    {
        if (is_int($value)) {
            return (string) $value;
        }

        if (is_string($value)) {
            $trimmed = trim($value);

            return $trimmed === '' ? null : $trimmed;
        }

        return null;
    }
}
