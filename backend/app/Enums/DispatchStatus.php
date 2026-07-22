<?php

declare(strict_types=1);

namespace App\Enums;

enum DispatchStatus: string
{
    case Planned = 'planned';
    case InTransit = 'in_transit';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
}
