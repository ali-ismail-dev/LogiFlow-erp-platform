<?php

declare(strict_types=1);

namespace App\Http\Requests\Logistics;

use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreVehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tenantId = app(TenantManager::class)->id;

        return [
            'name' => ['required', 'string', 'max:100'],
            'license_plate' => [
                'required',
                'string',
                'max:50',
                Rule::unique('vehicles', 'license_plate')->where(fn ($query) => $query->where('tenant_id', $tenantId)),
            ],
            'max_weight_capacity_kg' => ['required', 'numeric'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}