<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Logistics;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateDispatchStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:planned,in_transit,arrived,completed'],
        ];
    }
}
