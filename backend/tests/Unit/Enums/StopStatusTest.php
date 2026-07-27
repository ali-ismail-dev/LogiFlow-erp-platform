<?php

declare(strict_types=1);

namespace Tests\Unit\Enums;

use App\Enums\StopStatus;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class StopStatusTest extends TestCase
{
    #[Test]
    public function it_has_expected_cases(): void
    {
        $this->assertSame('pending', StopStatus::Pending->value);
        $this->assertSame('en_route', StopStatus::EnRoute->value);
        $this->assertSame('arrived', StopStatus::Arrived->value);
        $this->assertSame('completed', StopStatus::Completed->value);
        $this->assertSame('failed', StopStatus::Failed->value);
    }
}
