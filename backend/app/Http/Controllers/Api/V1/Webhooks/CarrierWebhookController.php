<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Webhooks;

use App\Actions\Webhooks\ProcessCarrierWebhookAction;
use App\Events\DispatchMovementUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Webhooks\CarrierWebhookRequest;
use App\Models\Dispatch;
use Illuminate\Http\JsonResponse;
use RuntimeException;

final class CarrierWebhookController extends Controller
{
    public function __construct(
        private readonly ProcessCarrierWebhookAction $processWebhook,
    ) {}

    public function __invoke(CarrierWebhookRequest $request, string $carrier): JsonResponse
    {
        if (! $this->hasValidSignature($request, $carrier)) {
            return response()->json([
                'message' => 'Invalid or missing carrier webhook signature.',
            ], 401);
        }

        $dispatch = Dispatch::withoutTenancy()
            ->where('carrier_waybill_reference', $request->input('carrier_waybill_reference'))
            ->first();

        if ($dispatch === null) {
            return response()->json([
                'message' => 'No dispatch found for the given carrier waybill reference.',
            ], 404);
        }

        try {
            $dispatch = ($this->processWebhook)($dispatch, $carrier, $request->validated());
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        DispatchMovementUpdated::dispatch($dispatch);

        return response()->json(['message' => 'Tracking update applied.'], 200);
    }

    private function hasValidSignature(CarrierWebhookRequest $request, string $carrier): bool
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
}
