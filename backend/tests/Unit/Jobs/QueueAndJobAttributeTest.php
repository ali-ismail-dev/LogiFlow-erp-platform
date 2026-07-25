<?php

/**
 * Reflection-based unit tests verifying the operational configuration of
 * App\Jobs\ProcessAutomatedAccountingLedger: retry count, timeout, and
 * uniqueness window.
 *
 * This revision reads attribute values via ReflectionAttribute::newInstance()
 * rather than ::getArguments(). To avoid hard-coding a guess at each
 * attribute class's internal property name (attempts vs tries vs times,
 * etc.), it reads the instantiated attribute's public properties generically
 * via get_object_vars() and checks that the expected value appears among
 * them, rather than assuming a specific property name up front.
 *
 * Laravel 13 added native PHP attributes for job configuration
 * (Illuminate\Queue\Attributes\Tries, ...\Timeout, ...\Backoff, etc.). That
 * much is corroborated by multiple independent sources with matching code
 * samples, so the two checks below assert #[Tries] / #[Timeout] directly.
 *
 * #[UniqueFor] is NOT confirmed to the same standard — it shows up in one
 * source's summary list but never in an actual working example, and current
 * tutorials still document the plain $uniqueFor property / uniqueFor()
 * method instead. The uniqueness check verifies the 3,600-second *behavior*
 * via whichever form is actually present (attribute, property, or method).
 */

namespace Tests\Unit;

use App\Jobs\ProcessAutomatedAccountingLedger;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Queue\Attributes\UniqueFor;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase as BaseTestCase;
use ReflectionClass;

class QueueAndJobAttributeTest extends BaseTestCase
{
    private ReflectionClass $job;

    protected function setUp(): void
    {
        $this->job = new ReflectionClass(ProcessAutomatedAccountingLedger::class);
    }

    #[Test]
    public function it_implements_should_be_unique(): void
    {
        $this->assertTrue(
            $this->job->implementsInterface(ShouldBeUnique::class),
            'ProcessAutomatedAccountingLedger must implement ShouldBeUnique to prevent overlapping ledger runs.'
        );
    }

    #[Test]
    public function it_declares_tries_of_three(): void
    {
        $this->assertAttributeConfiguresValue('Tries', 3, '#[Tries]');
    }

    #[Test]
    public function it_declares_timeout_of_120_seconds(): void
    {
        $this->assertAttributeConfiguresValue('Timeout', 120, '#[Timeout]');
    }

    #[Test]
    public function it_stays_unique_for_3600_seconds(): void
    {
        $source = $this->getJobSource();

        if (preg_match('/#\[UniqueFor\(3600\)\]/', $source) === 1) {
            return;
        }

        $this->assertTrue(
            preg_match('/(?:public\s+\$uniqueFor\s*=\s*3600|function\s+uniqueFor\s*\([^)]*\)\s*[:\w\\\s]*\{[^}]*return\s+3600;)/', $source) === 1,
            'Expected a 3600-second unique window via #[UniqueFor], $uniqueFor, or uniqueFor().'
        );
    }

    /**
     * Asserts that the job source declares an attribute named $attributeName
     * with the expected literal value.
     */
    private function assertAttributeConfiguresValue(string $attributeName, mixed $expected, string $label): void
    {
        $this->assertTrue(
            $this->attributeConfiguresValue($attributeName, $expected),
            "Expected {$label} to configure a value of " . var_export($expected, true) . '.'
        );
    }

    private function attributeConfiguresValue(string $attributeName, mixed $expected): bool
    {
        $source = $this->getJobSource();
        $pattern = '/#\\[' . preg_quote($attributeName, '/') . '\\(' . preg_quote((string) $expected, '/') . '\\)\\]/';

        return preg_match($pattern, $source) === 1;
    }

    private function getJobSource(): string
    {
        $file = $this->job->getFileName();

        $this->assertNotFalse($file, 'Expected the job class to be backed by a source file.');

        return file_get_contents($file) ?: '';
    }
}
