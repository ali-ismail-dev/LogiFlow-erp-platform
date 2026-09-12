<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Database\QueryException;
use RuntimeException;

final class RegisterTenantAction
{
    public function __invoke(array $validated): Tenant
    {
        $baseSlug = Str::slug($validated['company_name']) ?: 'company';

        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                return DB::transaction(function () use ($validated, $baseSlug): Tenant {
                    $slug = $this->resolveUniqueSlug($baseSlug);

                    $tenant = Tenant::create([
                        'name' => $validated['company_name'],
                        'slug' => $slug,
                    ]);

                    app(TenantManager::class)->resolve($tenant);

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
            } catch (QueryException $exception) {
                if (! in_array($exception->getCode(), ['23000', '23505'], true) || $attempt === 2) {
                    throw $exception;
                }
            }
        }

        throw new RuntimeException('Unable to allocate a unique tenant slug.');
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
