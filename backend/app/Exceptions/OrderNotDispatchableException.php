<?php

declare(strict_types=1);

namespace App\Exceptions;

final class OrderNotDispatchableException extends DomainException
{
    public static function forOrder(string $orderNumber, string $currentStatus): self
    {
        return new self(
            "Order [{$orderNumber}] cannot be dispatched from status [{$currentStatus}].",
        );
    }

    public static function notFoundInTenant(int $orderId): self
    {
        return new self(
            "Order [{$orderId}] was not found within the active tenant scope.",
        );
    }
}
