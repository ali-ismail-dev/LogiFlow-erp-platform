<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Enums\DispatchStatus;

class ListDispatchesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            // Harmonized explicitly with our Phase 2 DispatchStatus Backed Enum cases
            'status' => ['sometimes', 'string', Rule::in(
                array_column(DispatchStatus::cases(), 'value')
            )],
            'driver_name' => ['sometimes', 'string', 'max:100'],
            'reference_code' => ['sometimes', 'string', 'max:100'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function filters(): array
    {
        return $this->safe()->only([
            'status',
            'driver_name',
            'reference_code',
            'per_page',
            'page',
        ]);
    }
}
