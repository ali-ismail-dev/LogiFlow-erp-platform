<?php

declare(strict_types=1);

namespace App\Http\Requests\Workspace;

use App\Enums\UserRole;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

final class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tenantId = app(TenantManager::class)->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('users')->where(fn($query) => $query->where('tenant_id', $tenantId)),
            ],
            // The RSC service role is a machine identity and must only be provisioned
            // via `php artisan logiflow:rsc-token`. It is intentionally excluded here
            // so it cannot be minted through the human user-provisioning API.
            'role' => ['required', (new Enum(UserRole::class))->except([UserRole::RscService])],
        ];
    }
}
