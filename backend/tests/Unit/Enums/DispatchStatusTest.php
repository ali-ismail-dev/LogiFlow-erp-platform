<?php

declare(strict_types=1);

namespace Tests\Unit\Enums;

use App\Enums\DispatchStatus;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class DispatchStatusTest extends TestCase
{
    #[Test]
    public function it_has_expected_cases(): void
    {
        $this->assertSame('planned', DispatchStatus::Planned->value);
        $this->assertSame('in_transit', DispatchStatus::InTransit->value);
        $this->assertSame('completed', DispatchStatus::Completed->value);
        $this->assertSame('cancelled', DispatchStatus::Cancelled->value);
    }
}
