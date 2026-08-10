<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Driver
 * @property-read \App\Models\User $user
 */
final class DriverResource extends JsonResource
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
            'user_id' => $this->user_id,
            // Nested metadata flattened from the underlying user relationship
            'name' => $this->user?->name,
            'email' => $this->user?->email,
            'license_number' => $this->license_number,
            'phone_number' => $this->phone_number,
            // Backed enum serializer — always emits the string scalar value
            'status' => $this->status instanceof \BackedEnum ? $this->status->value : (string) $this->status,
        ];
    }
}
