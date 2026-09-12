<?php

declare(strict_types=1);

namespace App\Http\Requests\Logistics;

use App\Enums\DriverStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreDriverRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tenantId = app(\App\Support\Tenancy\TenantManager::class)->id;

        return [
            'user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(fn($query) => $query->where('tenant_id', $tenantId)),
            ],
            'license_number' => ['required', 'string', 'max:50'],
            'phone_number' => ['required', 'string', 'max:30'],
            'status' => ['sometimes', Rule::enum(DriverStatus::class)],
        ];
    }
}
