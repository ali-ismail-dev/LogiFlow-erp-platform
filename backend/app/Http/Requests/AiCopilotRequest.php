<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AiCopilotRequest extends FormRequest
{
    /**
     * Authentication and tenant checks are enforced by the `auth:sanctum`
     * and `tenant` route middleware, not here — this only validates shape.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'prompt' => ['required', 'string', 'min:3', 'max:1000'],
            'context_history' => ['nullable', 'array', 'max:10'],
        ];
    }
}
