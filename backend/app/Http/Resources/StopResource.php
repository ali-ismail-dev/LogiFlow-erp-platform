<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Http\Resources\OrderResource;

/**
 * NOTE: illustrative field mapping, same caveat as DispatchResource —
 * align with Phase 2's actual `stops` migration.
 *
 * @mixin \App\Models\Stop
 */
class StopResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sequence' => $this->sequence,
            'status' => $this->status, // Bound to StopStatus Enum

            // Matches our exact JSONB migration address column layout
            'destination_address' => $this->destination_address,

            'eta' => optional($this->eta)->toIso8601String(),
            'arrived_at' => optional($this->arrived_at)->toIso8601String(),
            'completed_at' => optional($this->completed_at)->toIso8601String(),

            'failure_reason' => $this->failure_reason,

            // Eager-loaded relational child resource connection guard
            'order' => new OrderResource($this->whenLoaded('order')),
        ];
    }
}
