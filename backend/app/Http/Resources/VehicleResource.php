<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Vehicle
 */
final class VehicleResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tenant_id' => $this->tenant_id,
            'name' => $this->name,
            'license_plate' => $this->license_plate,
            'max_weight_capacity_kg' => $this->max_weight_capacity_kg,
            // The model casts this attribute to boolean; coerce explicitly so the
            // outbound wire contract always emits a true boolean primitive.
            'is_active' => (bool) $this->is_active,
        ];
    }
}
