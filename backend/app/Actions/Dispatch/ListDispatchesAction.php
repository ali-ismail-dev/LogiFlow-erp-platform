<?php

declare(strict_types=1);

namespace App\Actions\Dispatch;

use App\Models\Dispatch;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class ListDispatchesAction
{
    /**
     * Executes a tenant-scoped range-scan against active dispatches.
     * 
     * @param array<string, mixed> $filters
     * @return LengthAwarePaginator
     */
    public function __invoke(array $filters): LengthAwarePaginator
    {
        $query = Dispatch::query()
            // Defensive Eager-Loading prevents N+1 query traps completely
            ->with(['warehouse', 'stops.order']);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['reference_code'])) {
            $query->where('reference_code', 'like', '%' . $filters['reference_code'] . '%');
        }

        if (!empty($filters['driver_name'])) {
            $query->where('driver_name', 'like', '%' . $filters['driver_name'] . '%');
        }

        // Returns a secure, paginated collection capped by our FormRequest limits
        return $query->paginate((int) ($filters['per_page'] ?? 15));
    }
}
