<?php

declare(strict_types=1);

namespace App\Enums;

enum StopStatus: string
{
    case Pending = 'pending';
    case EnRoute = 'en_route';
    case Arrived = 'arrived';
    case Completed = 'completed';
    case Failed = 'failed';
}
