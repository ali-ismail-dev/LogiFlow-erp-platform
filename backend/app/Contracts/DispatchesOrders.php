<?php

declare(strict_types=1);

namespace App\Contracts;

use App\DataTransferObjects\DispatchOrdersData;
use App\Models\Dispatch;

interface DispatchesOrders
{
    public function __invoke(DispatchOrdersData $data): Dispatch;
}
