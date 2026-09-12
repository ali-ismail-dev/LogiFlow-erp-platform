<?php

declare(strict_types=1);

namespace App\Enums;

enum UserRole: string
{
    case Dispatcher = 'dispatcher';
    case WarehouseManager = 'warehouse_manager';
    case SuperAdmin = 'super_admin';
    case Driver = 'driver';

    /** Machine identity used by the Next.js RSC to fetch data server-to-server.
     *  Never associated with a human operator. Cannot log in interactively.
     *  Provisioned only via `php artisan logiflow:rsc-token`. */
    case RscService = 'rsc_service';
}
