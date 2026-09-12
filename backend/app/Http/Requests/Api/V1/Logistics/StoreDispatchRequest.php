<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Logistics;

use Illuminate\Foundation\Http\FormRequest;

final class StoreDispatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'order_ids' => ['required', 'array', 'max:250'],
            'order_ids.*' => ['integer', 'distinct', 'exists:orders,id'],
            'driver_id' => ['nullable', 'integer', 'exists:drivers,id'],
            'vehicle_id' => ['nullable', 'integer', 'exists:vehicles,id'],
        ];
    }
}
