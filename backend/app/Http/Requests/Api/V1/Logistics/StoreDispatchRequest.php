<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Logistics;

use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreDispatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tenantId = app(TenantManager::class)->id;

        return [
            'order_ids' => ['required', 'array', 'max:250'],
            'order_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('orders', 'id')->where(fn($query) => $query->where('tenant_id', $tenantId)),
            ],
            'driver_id' => [
                'required',
                'integer',
                Rule::exists('drivers', 'id')->where(fn($query) => $query->where('tenant_id', $tenantId)),
            ],
            'vehicle_id' => [
                'required',
                'integer',
                Rule::exists('vehicles', 'id')->where(fn($query) => $query->where('tenant_id', $tenantId)),
            ],
        ];
    }
}
