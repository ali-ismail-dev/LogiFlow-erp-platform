<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\RegisterTenantAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\RegisterCompanyRequest;
use Illuminate\Http\JsonResponse;

final class PublicRegistrationController extends Controller
{
    public function __construct(
        private readonly RegisterTenantAction $registerTenant
    ) {}

    public function register(RegisterCompanyRequest $request): JsonResponse
    {
        $tenant = ($this->registerTenant)($request->validated());

        return response()->json([
            'message' => 'Company space provisioned successfully.',
            'data' => [
                'tenant' => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                ],
            ],
        ], 201);
    }
}
