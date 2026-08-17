<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class PublicRegistrationController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $normalizedEmail = strtolower($validated['admin_email']);

        if (DB::table('users')->whereRaw('LOWER(email) = ?', [$normalizedEmail])->exists()) {
            return response()->json([
                'message' => 'The provided admin email is already in use.',
                'errors' => [
                    'admin_email' => ['The admin email has already been taken.'],
                ],
            ], 422);
        }

        $baseSlug = Str::slug($validated['company_name']) ?: 'company';
        $slug = $this->resolveUniqueSlug($baseSlug);

        $data = DB::transaction(function () use ($validated, $slug) {
            $tenant = Tenant::create([
                'name' => $validated['company_name'],
                'slug' => $slug,
            ]);

            $warehouseName = $tenant->name . ' Central Hub';
            $warehouseCode = strtoupper(substr($slug, 0, 4)) . '-01';

            $warehouseId = DB::table('warehouses')->insertGetId([
                'tenant_id' => $tenant->id,
                'name' => $warehouseName,
                'code' => $warehouseCode,
                'address' => json_encode([
                    'street' => 'Address Pending',
                    'city' => 'City Pending',
                    'state' => null,
                    'zip_code' => null,
                ]),
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $userId = DB::table('users')->insertGetId([
                'tenant_id' => $tenant->id,
                'name' => $validated['admin_name'],
                'email' => strtolower($validated['admin_email']),
                'password' => Hash::make($validated['password']),
                'role' => 'super_admin',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'tenant' => $tenant,
                'warehouse_id' => $warehouseId,
                'user_id' => $userId,
            ];
        });

        return response()->json([
            'message' => 'Company space provisioned successfully.',
            'data' => [
                'tenant' => [
                    'id' => $data['tenant']->id,
                    'name' => $data['tenant']->name,
                    'slug' => $data['tenant']->slug,
                ],
            ],
        ], 201);
    }

    protected function resolveUniqueSlug(string $baseSlug): string
    {
        $slug = $baseSlug;
        $suffix = 1;

        while (Tenant::where('slug', $slug)->exists()) {
            $slug = $baseSlug . '-' . $suffix;
            $suffix++;
        }

        return $slug;
    }
}
