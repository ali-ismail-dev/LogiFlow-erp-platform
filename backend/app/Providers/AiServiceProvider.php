<?php

declare(strict_types=1);

namespace App\Providers;

use App\Contracts\LlmProviderInterface;
use App\Services\Ai\Providers\OpenAiLlmProvider;
use App\Services\Ai\Providers\MockLlmProvider;
use App\Services\Ai\Providers\OllamaLlmProvider;
use App\Services\Ai\ToolRegistry;
use App\Services\Ai\Tools\CompareDriverWorkloadsTool;
use App\Services\Ai\Tools\FindAtRiskStopsTool;
use App\Services\Ai\Tools\GetDispatchStatusTool;
use App\Services\Ai\Tools\GetTelemetrySummaryTool;
use App\Services\Ai\Tools\SummarizeOperationalEventsTool;
use Illuminate\Support\ServiceProvider;

class AiServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(LlmProviderInterface::class, function () {
            $provider = config('services.ai.provider', env('AI_DEFAULT_PROVIDER', 'mock'));

            return match ($provider) {
                'mock' => new MockLlmProvider(),
                'openai' => new OpenAiLlmProvider(),
                'ollama' => new OllamaLlmProvider(),
                // Future providers register here, e.g.:
                default => new MockLlmProvider(),
            };
        });

        $this->app->singleton(ToolRegistry::class, function () {
            return new ToolRegistry([
                new FindAtRiskStopsTool(),
                new GetDispatchStatusTool(),
                new CompareDriverWorkloadsTool(),
                new SummarizeOperationalEventsTool(),
                new GetTelemetrySummaryTool(),
            ]);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
