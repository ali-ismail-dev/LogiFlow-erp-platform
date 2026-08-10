<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Fail-closed driver operational status taxonomy.
 *
 * Mirrors the UserRole / DispatchStatus backed-enum pattern so that every
 * read and write to the drivers.status column is strictly validated and
 * serialized through a single, type-safe source of truth.
 */
enum DriverStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';
    case OnTrip = 'on_trip';
}
