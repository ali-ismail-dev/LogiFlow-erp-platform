<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Dispatch\ListDispatchesAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ListDispatchesRequest;
use App\Http\Resources\DispatchResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class DispatchController extends Controller
{
    public function __construct(
        private readonly ListDispatchesAction $listDispatches,
    ) {}

    public function index(ListDispatchesRequest $request): AnonymousResourceCollection
    {
        // NOTE: This route is intentionally NOT auth-protected (see api.php).
        // The React Server Component (RSC) fetches /dispatches server-to-server
        // via the X-Tenant-ID header with no browser session cookie, so an
        // authenticated Gate check would fail and return an empty list on every
        // refresh. Tenant isolation is strictly enforced by the global
        // TenantScope, which fails closed via TenantContextNotResolvedException.
        $dispatches = ($this->listDispatches)($request->validated());

        return DispatchResource::collection($dispatches);
    }
}
