<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Webhooks;

use App\DataTransferObjects\Logistics\CarrierTrackingUpdate;
use App\Enums\Logistics\CarrierShipmentStatus;
use App\Events\DispatchMovementUpdated;
use App\Http\Controllers\Controller;
use App\Models\Dispatch;
use App\Models\Stop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use RuntimeException;

final class CarrierWebhookController extends Controller
{
    public function __invoke(Request $request, string $carrier): JsonResponse
    {
        if (! $this->hasValidSignature($request, $carrier)) {
            return response()->json([
                'message' => 'Invalid or missing carrier webhook signature.',
            ], 401);
        }

        $validated = Validator::make($request->all(), [
            'carrier_waybill_reference' => ['required', 'string', 'min:1'],
            'stop_sequence' => ['nullable', 'integer', 'min:1'],
            'status' => ['required', 'string', Rule::enum(CarrierShipmentStatus::class)],
            'status_timestamp' => ['required', 'date'],
            'location_description' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'raw_carrier_status_code' => ['nullable', 'string'],
        ])->validate();

        $dispatch = Dispatch::withoutTenancy()
            ->where('carrier_waybill_reference', $validated['carrier_waybill_reference'])
            ->first();

        if ($dispatch === null) {
            return response()->json([
                'message' => 'No dispatch found for the given carrier waybill reference.',
            ], 404);
        }

        $trackingUpdate = CarrierTrackingUpdate::fromArray([
            ...$validated,
            'carrier_name' => $carrier,
        ]);

        $stopSequence = $validated['stop_sequence'] ?? null;

        try {
            DB::transaction(function () use ($dispatch, $stopSequence, $trackingUpdate): void {
                if ($stopSequence !== null) {
                    $this->applyStopLevelUpdate($dispatch, $stopSequence, $trackingUpdate);
                } else {
                    $this->applyDispatchLevelUpdate($dispatch, $trackingUpdate);
                }
            });
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        // FIXED: Eager load both 'stops' AND 'warehouse' cleanly bypassing the global multi-tenant resolution scope check.
        // This ensures the broadcast event has all required serialization properties fully hydrated before firing.
        $dispatch = $dispatch->newQueryWithoutScopes()
            ->with([
                'stops' => fn($query) => $query->withoutTenancy(),
                'warehouse' => fn($query) => $query->withoutTenancy()
            ])
            ->findOrFail($dispatch->id);

        DispatchMovementUpdated::dispatch($dispatch);

        return response()->json(['message' => 'Tracking update applied.'], 200);
    }

    private function hasValidSignature(Request $request, string $carrier): bool
    {
        $signatureHeader = $request->header('X-Carrier-Signature');

        if (! is_string($signatureHeader) || $signatureHeader === '') {
            return false;
        }

        $secret = (string) config("services.carriers.{$carrier}.webhook_secret");

        if ($secret === '') {
            return false;
        }

        $expectedSignature = hash_hmac('sha256', $request->getContent(), $secret);

        return hash_equals($expectedSignature, $signatureHeader);
    }

    /**
     * @throws RuntimeException When the dispatch has no stop at that sequence.
     */
    private function applyStopLevelUpdate(Dispatch $dispatch, int $stopSequence, CarrierTrackingUpdate $update): void
    {
        /** @var Stop|null $stop */
        $stop = $dispatch->stops()->withoutTenancy()->where('sequence', $stopSequence)->first();

        if ($stop === null) {
            throw new RuntimeException(sprintf(
                'Dispatch #%d has no stop with sequence %d.',
                $dispatch->id,
                $stopSequence,
            ));
        }

        $stop->update(['status' => $update->status->value]);

        $freshDispatch = $dispatch->newQueryWithoutScopes()
            ->with(['stops' => fn($q) => $q->withoutTenancy()])
            ->find($dispatch->id);

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
