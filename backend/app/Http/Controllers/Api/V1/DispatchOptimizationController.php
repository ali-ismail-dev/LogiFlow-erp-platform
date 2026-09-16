<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Dispatch\RecommendVehicleAction;
use App\Actions\Dispatch\SuggestOrderSplitAction;
use App\Http\Controllers\Controller;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DispatchOptimizationController extends Controller
{
    public function recommendVehicle(Request $request, RecommendVehicleAction $action): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1'],
            'order_ids.*' => ['integer', 'distinct'],
            'preferred_vehicle_type' => ['nullable', 'string', 'max:100'],
            'scheduled_at' => ['nullable', 'date'],
            'window_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
        ]);

        return response()->json(['data' => $action->execute(
            (int) app(TenantManager::class)->id,
            $data['order_ids'],
            $data['preferred_vehicle_type'] ?? null,
            $data['scheduled_at'] ?? null,
            $data['window_minutes'] ?? 60,
        )]);
    }

    public function suggestSplit(Request $request, SuggestOrderSplitAction $action): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1'],
            'order_ids.*' => ['integer', 'distinct'],
            'target_vehicle_identifier' => ['nullable', 'string', 'max:100'],
        ]);

        return response()->json(['data' => $action->execute(
            (int) app(TenantManager::class)->id,
            $data['order_ids'],
            $data['target_vehicle_identifier'] ?? null,
        )]);
    }
}
