<?php

declare(strict_types=1);

namespace Tests\Feature\Providers;

use App\Contracts\LlmProviderInterface;
use App\Providers\AiServiceProvider;
use App\Services\Ai\Providers\MockLlmProvider;
use App\Services\Ai\Providers\OllamaLlmProvider;
use App\Services\Ai\Providers\OpenAiLlmProvider;
use App\Services\Ai\ToolRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class AiServiceProviderTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_registers_the_default_mock_provider_and_tool_registry(): void
    {
        config(['services.ai.provider' => 'mock']);

        $provider = $this->app->make(LlmProviderInterface::class);

        $this->assertInstanceOf(MockLlmProvider::class, $provider);
        $this->assertInstanceOf(ToolRegistry::class, $this->app->make(ToolRegistry::class));
    }

    #[Test]
    public function it_registers_openai_and_ollama_providers_when_configured(): void
    {
        config(['services.ai.provider' => 'openai']);
        $this->assertInstanceOf(OpenAiLlmProvider::class, $this->app->make(LlmProviderInterface::class));

        config(['services.ai.provider' => 'ollama']);
        $this->assertInstanceOf(OllamaLlmProvider::class, $this->app->make(LlmProviderInterface::class));

        config(['services.ai.provider' => 'unknown']);
        $this->assertInstanceOf(MockLlmProvider::class, $this->app->make(LlmProviderInterface::class));
    }
}
