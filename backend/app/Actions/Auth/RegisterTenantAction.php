<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class RegisterTenantAction
{
    public function __invoke(array $validated): Tenant
    {
        $baseSlug = Str::slug($validated['company_name']) ?: 'company';
        $slug = $this->resolveUniqueSlug($baseSlug);

        return DB::transaction(function () use ($validated, $slug): Tenant {
            $tenant = Tenant::create([
                'name' => $validated['company_name'],
                'slug' => $slug,
            ]);

            Warehouse::create([
                'tenant_id' => $tenant->id,
                'name' => $tenant->name . ' Central Hub',
                'code' => strtoupper(substr($slug, 0, 4)) . '-01',
                'address' => [
                    'street' => 'Address Pending',
                    'city' => 'City Pending',
                    'state' => null,
                    'zip_code' => null,
                ],
                'is_active' => true,
            ]);

            User::create([
                'tenant_id' => $tenant->id,
                'name' => $validated['admin_name'],
                'email' => strtolower($validated['admin_email']),
                'password' => Hash::make($validated['password']),
                'role' => 'super_admin',
            ]);

            return $tenant;
        });
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
