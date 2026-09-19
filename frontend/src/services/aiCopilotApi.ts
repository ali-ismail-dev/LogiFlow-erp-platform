import { createApiClient } from "@/lib/api/apiClient";

export interface AiCitation {
  type: "dispatch" | "driver" | "order" | "stop" | string;
  id: string;
  reason: string;
}

export interface AiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface AiCopilotResponse {
  answer: string;
  citations: AiCitation[];
  tools_used: string[];
  suggested_action: Record<string, unknown> | null;
  confidence: "low" | "medium" | "high" | string;
  usage: AiUsage;
}

interface AiCopilotEnvelope {
  data: AiCopilotResponse;
}

export class AiCopilotApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "AiCopilotApiError";
    this.status = status;
  }
}

function logCopilotError(error: unknown): void {
  const requestError = error as {
    response?: { status?: number; data?: unknown };
    message?: string;
  };

  console.error(
    "AI Copilot Error Details:",
    requestError.response?.status,
    requestError.response?.data || requestError.message,
  );
}

function resolveCopilotBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
}

export async function askCopilot(
  prompt: string,
  contextHistory: Array<Record<string, unknown>> = [],
  tenant?: string,
  signal?: AbortSignal,
): Promise<AiCopilotResponse> {
  const normalizedPrompt = prompt.trim();

  if (normalizedPrompt.length < 3) {
    throw new AiCopilotApiError("Please enter at least 3 characters.");
  }

  try {
    const backendBaseUrl = resolveCopilotBaseUrl().replace(/\/$/, "");
    const response = await createApiClient({
      baseUrl: backendBaseUrl,
      tenant,
      timeout: 30000,
    }).post<AiCopilotEnvelope>("/ai/ask", {
      prompt: normalizedPrompt,
      context_history: contextHistory,
    }, { signal });

    if (response.status < 200 || response.status >= 300) {
      const responseBody = response.data as { error?: unknown; message?: unknown } | null | undefined;
      console.error("AI Copilot Error Details:", response.status, response.data);

      const message = responseBody && typeof responseBody === "object" && ("error" in responseBody || "message" in responseBody)
        ? String(responseBody.error ?? responseBody.message ?? "The Copilot request failed.")
        : response.status === 401
          ? "Your workspace session has expired. Please sign in again before using Copilot."
          : response.status === 403
            ? "You are not authorized to use Copilot in this workspace."
            : response.status === 404
              ? "The Copilot workspace or tenant could not be found."
              : response.status === 419
                ? "Your security session expired. Please refresh the page and sign in again."
                : "The Copilot request failed.";

      throw new AiCopilotApiError(message, response.status);
    }

    if (!response.data?.data || typeof response.data.data.answer !== "string") {
      throw new AiCopilotApiError("The Copilot returned an invalid response.");
    }

    return {
      ...response.data.data,
      citations: Array.isArray(response.data.data.citations) ? response.data.data.citations : [],
      tools_used: Array.isArray(response.data.data.tools_used) ? response.data.data.tools_used : [],
      usage: response.data.data.usage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        estimated_cost_usd: 0,
      },
    };
  } catch (error) {
    logCopilotError(error);

    if (error instanceof AiCopilotApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new AiCopilotApiError("The Copilot is temporarily unavailable. Please try again.");
  }
}
