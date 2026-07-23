<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Dispatch
 */
class DispatchResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            // Structural payload fields perfectly matching Phase 2/3 contracts
            'id' => $this->id,
            'reference_code' => $this->reference_code,
            'status' => $this->status, // Backed Enum serializer
            'driver_name' => $this->driver_name,
            'vehicle_identifier' => $this->vehicle_identifier,

            'departed_at' => optional($this->departed_at)->toIso8601String(),
            'scheduled_at' => optional($this->scheduled_at)->toIso8601String(),
            'completed_at' => optional($this->completed_at)->toIso8601String(),

            // Relation bindings using structural whenLoaded checks
            'warehouse' => new WarehouseResource($this->whenLoaded('warehouse')),
            'stops' => StopResource::collection($this->whenLoaded('stops')),
        ];
    }
}
