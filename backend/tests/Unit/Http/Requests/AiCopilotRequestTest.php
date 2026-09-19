<?php

declare(strict_types=1);

namespace Tests\Unit\Http\Requests;

use App\Http\Requests\AiCopilotRequest;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

final class AiCopilotRequestTest extends TestCase
{
    #[Test]
    public function it_allows_the_ai_copilot_request_when_the_payload_shape_is_valid(): void
    {
        $request = new AiCopilotRequest();

        $this->assertTrue($request->authorize());

        $validator = Validator::make([
            'prompt' => 'What is the current fleet status?',
            'context_history' => [
                ['role' => 'user', 'content' => 'Previous user message'],
                ['role' => 'assistant', 'content' => 'Previous assistant reply'],
            ],
        ], $request->rules());

        $this->assertFalse($validator->fails());
    }

    #[Test]
    public function it_rejects_invalid_prompt_and_context_payloads(): void
    {
        $request = new AiCopilotRequest();

        $validator = Validator::make([
            'prompt' => 'Hi',
            'context_history' => 'not-an-array',
        ], $request->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('prompt', $validator->errors()->toArray());
        $this->assertArrayHasKey('context_history', $validator->errors()->toArray());
    }
}
