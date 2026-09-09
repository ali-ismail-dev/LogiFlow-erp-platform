<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Logistics;

use Illuminate\Foundation\Http\FormRequest;

final class AssignFleetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'driver_id' => ['required', 'integer'],
            'vehicle_id' => ['required', 'integer'],
        ];
    }
}
