<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Ai\Providers;

use App\DataTransferObjects\AiConversationRequest;
use App\Services\Ai\Providers\MockLlmProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class MockLlmProviderTest extends TestCase
{
    #[Test]
    public function it_returns_the_delayed_dispatch_response_and_filters_available_tools(): void
    {
        $response = (new MockLlmProvider())->ask(
            new AiConversationRequest('Which stops are overdue?', 1, 2),
            [
                'sla_risk_scan',
                ['type' => 'function', 'function' => ['name' => 'dispatch_lookup']],
                ['malformed' => true],
            ],
        );

        $this->assertSame('high', $response->confidence);
        $this->assertStringContainsString('at risk', $response->answer);
        $this->assertSame(['dispatch_lookup', 'sla_risk_scan'], $response->toolsUsed);
        $this->assertSame('reassign_stop', $response->suggestedAction['type']);
    }

    #[Test]
    public function it_returns_driver_and_generic_responses_for_matching_prompts(): void
    {
        $provider = new MockLlmProvider();

        $driverResponse = $provider->ask(
            new AiConversationRequest('Compare driver workload and capacity', 1, 2),
            ['unrelated_tool'],
        );
        $genericResponse = $provider->ask(
            new AiConversationRequest('Give me an operations summary', 1, 2),
        );

        $this->assertSame('medium', $driverResponse->confidence);
        $this->assertSame(['unrelated_tool'], $driverResponse->toolsUsed);
        $this->assertSame('high', $genericResponse->confidence);
        $this->assertSame(['operations_summary'], $genericResponse->toolsUsed);
        $this->assertNull($genericResponse->suggestedAction);
    }

    #[Test]
    public function it_exposes_provider_metadata(): void
    {
        $provider = new MockLlmProvider();

        $this->assertSame('mock', $provider->getProviderName());
        $this->assertSame('mock-v1', $provider->getModelName());
    }
}
