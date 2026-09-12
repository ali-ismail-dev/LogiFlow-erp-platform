<?php

declare(strict_types=1);

namespace App\Actions\Webhooks;

use App\DataTransferObjects\Logistics\CarrierTrackingUpdate;
use App\Enums\Logistics\CarrierShipmentStatus;
use App\Models\Dispatch;
use App\Models\Stop;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use RuntimeException;

final class ProcessCarrierWebhookAction
{
    /**
     * @param array<string, mixed> $validated
     * @throws RuntimeException When the dispatch has no stop at that sequence.
     */
    public function __invoke(Dispatch $dispatch, string $carrier, array $validated): ?Dispatch
    {
        $trackingUpdate = CarrierTrackingUpdate::fromArray([
            ...$validated,
            'carrier_name' => $carrier,
        ]);

        $stopSequence = $validated['stop_sequence'] ?? null;

        $wasApplied = DB::transaction(function () use ($dispatch, $carrier, $validated, $stopSequence, $trackingUpdate): bool {
            $dispatch = $dispatch->newQueryWithoutScopes()
                ->lockForUpdate()
                ->findOrFail($dispatch->id);

            $inserted = DB::table('carrier_webhook_events')->insertOrIgnore([
                'carrier' => $carrier,
                'event_id' => $validated['event_id'],
                'dispatch_id' => $dispatch->id,
                'status_timestamp' => $trackingUpdate->statusTimestamp,
                'processed_at' => now(),
            ]);

            if ($inserted === 0) {
                return false;
            }

            if (
                $dispatch->carrier_status_timestamp !== null
                && $dispatch->carrier_status_timestamp->gte(Carbon::instance($trackingUpdate->statusTimestamp))
            ) {
                return false;
            }

            if ($stopSequence !== null) {
                $this->applyStopLevelUpdate($dispatch, $stopSequence, $trackingUpdate);
            } else {
                $this->applyDispatchLevelUpdate($dispatch, $trackingUpdate);
            }

            $dispatch->update([
                'carrier_status_timestamp' => $trackingUpdate->statusTimestamp,
            ]);

            return true;
        });

        if (! $wasApplied) {
            return null;
        }

        return $dispatch->newQueryWithoutScopes()
            ->with([
                'stops' => fn($query) => $query->withoutTenancy(),
                'warehouse' => fn($query) => $query->withoutTenancy(),
            ])
            ->findOrFail($dispatch->id);
    }

    /**
     * @throws RuntimeException When the dispatch has no stop at that sequence.
     */
    private function applyStopLevelUpdate(Dispatch $dispatch, int $stopSequence, CarrierTrackingUpdate $update): void
    {
        /** @var Stop|null $stop */
        $stop = $dispatch->stops()
            ->withoutTenancy()
            ->where('sequence', $stopSequence)
            ->lockForUpdate()
            ->first();

        if ($stop === null) {
            throw new RuntimeException(sprintf(
                'Dispatch #%d has no stop with sequence %d.',
                $dispatch->id,
                $stopSequence,
            ));
        }

        $stop->update(['status' => $update->status->value]);

        $freshDispatch = $dispatch->newQueryWithoutScopes()
            ->with(['stops' => fn($query) => $query->withoutTenancy()])
            ->findOrFail($dispatch->id);

        $dispatch->update([
            'status' => $this->recomputeDispatchStatus($freshDispatch, $update->status)->value,
        ]);
    }

    private function applyDispatchLevelUpdate(Dispatch $dispatch, CarrierTrackingUpdate $update): void
    {
        $dispatch->update(['status' => $update->status->value]);

        $dispatch->stops()
            ->withoutTenancy()
            ->whereNotIn('status', [
                CarrierShipmentStatus::Delivered->value,
                CarrierShipmentStatus::DeliveryFailed->value,
            ])
            ->update(['status' => $update->status->value]);
    }

    private function recomputeDispatchStatus(Dispatch $dispatch, CarrierShipmentStatus $latestStopStatus): CarrierShipmentStatus
    {
        $stopStatusValues = $dispatch->stops->map(
            static fn(Stop $stop): string => $stop->status instanceof CarrierShipmentStatus
                ? $stop->status->value
                : (string) $stop->status
        );

        if ($stopStatusValues->every(static fn(string $value): bool => $value === CarrierShipmentStatus::Delivered->value)) {
            return CarrierShipmentStatus::Delivered;
        }

        $terminalValues = [CarrierShipmentStatus::Delivered->value, CarrierShipmentStatus::DeliveryFailed->value];

        if ($stopStatusValues->every(static fn(string $value): bool => in_array($value, $terminalValues, true))) {
            return CarrierShipmentStatus::DeliveryFailed;
        }

        return $latestStopStatus;
    }
}
