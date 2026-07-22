<?php

declare(strict_types=1);

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Dispatched = 'dispatched';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

    public function isDispatchable(): bool
    {
        return match ($this) {
            self::Pending, self::Processing => true,
            default => false,
        };
    }
}
