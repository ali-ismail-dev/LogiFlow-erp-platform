<?php

declare(strict_types=1);

namespace App\Http\Requests\Workspace;

use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tenantId = app(TenantManager::class)->id;

        return [
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'order_number' => [
                'required',
                'string',
                'max:255',
                Rule::unique('orders', 'order_number')->where(fn ($query) => $query->where('tenant_id', $tenantId)),
            ],
            'customer_name' => ['required', 'string', 'max:255'],
            'total_weight_kg' => ['required', 'numeric', 'gt:0'],
            'shipping_address' => ['required', 'array'],
            'shipping_address.street' => ['required', 'string', 'max:255'],
            'shipping_address.city' => ['required', 'string', 'max:100'],
            'status' => ['required', 'string', 'in:pending'],
        ];
    }
}