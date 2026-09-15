"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, ChevronDown, CircleStop, Command, Loader2, Send, Sparkles, X } from "lucide-react";
import { AiCitationBadge } from "@/components/ai/AiCitationBadge";
import { AiPresetChips } from "@/components/ai/AiPresetChips";
import {
  AiCopilotApiError,
  askCopilot,
  type AiCitation,
  type AiCopilotResponse,
} from "@/services/aiCopilotApi";

interface AiCopilotDrawerProps {
  tenantSlug: string;
  provider?: "mock" | "openai" | "ollama" | string;
}

type UserMessage = {
  id: string;
  role: "user";
  content: string;
};

type AssistantMessage = {
  id: string;
  role: "assistant";
  response: AiCopilotResponse;
};

type CopilotMessage = UserMessage | AssistantMessage;

const providerLabels: Record<string, string> = {
  mock: "Mock Engine",
  openai: "OpenAI",
  ollama: "Ollama Local",
};

function formatConfidence(confidence: string): string {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

function formatCost(cost: number): string {
  if (!cost) return "$0.00";
  return `$${cost.toFixed(4)}`;
}

function responseToHistory(response: AiCopilotResponse): Array<Record<string, unknown>> {
  return [{ role: "assistant", content: response.answer }];
}

export function AiCopilotDrawer({ tenantSlug, provider = "mock" }: AiCopilotDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputPrompt, setInputPrompt] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<AiCopilotResponse["usage"] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, errorMessage]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    inputRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  async function submitPrompt(promptValue: string) {
    const prompt = promptValue.trim();
    if (!prompt || isLoading) return;

    const userMessage: UserMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
    };
    const previousHistory = messages.flatMap((message) =>
      message.role === "user"
        ? [{ role: "user", content: message.content }]
        : responseToHistory(message.response),
    );

    setMessages((current) => [...current, userMessage]);
    setInputPrompt("");
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await askCopilot(prompt, previousHistory.slice(-10), tenantSlug);
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", response },
      ]);
      setLastUsage(response.usage);
    } catch (error) {
      const requestError = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      console.error(
        "AI Copilot Error Details:",
        requestError.response?.status,
        requestError.response?.data || requestError.message,
      );

      const message = error instanceof AiCopilotApiError
        ? error.message
        : "The Copilot is temporarily unavailable. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt(inputPrompt);
  }

  function handleCitationClick(citation: AiCitation) {
    window.location.href = `/${encodeURIComponent(tenantSlug)}/dashboard#${encodeURIComponent(citation.id)}`;
  }

  const providerLabel = providerLabels[provider] ?? provider;
  const hasMessages = messages.length > 0;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open LogiFlow Copilot"
          className="fixed bottom-5 right-5 z-50 flex h-14 items-center gap-2 rounded-2xl border border-emerald-300/30 bg-zinc-900 px-4 text-sm font-semibold text-emerald-100 shadow-2xl shadow-emerald-950/40 transition-all hover:-translate-y-1 hover:border-emerald-200/60 hover:bg-zinc-800"
        >
          <Sparkles className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          Ask Operations
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="LogiFlow Copilot">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close Copilot"
            onClick={() => setIsOpen(false)}
          />
          <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/70 animate-[ef-slide-in_220ms_ease-out]">
            <header className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/80 px-5 py-4 backdrop-blur-xl">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-zinc-50">LogiFlow Copilot</h2>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      {providerLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">Operational answers grounded in your workspace</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                aria-label="Close Copilot"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800 sm:px-5">
              {!hasMessages && !isLoading && (
                <div className="flex min-h-full flex-col justify-center py-8">
                  <div className="mb-6 max-w-md">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Operations intelligence</p>
                    <h3 className="text-2xl font-semibold tracking-tight text-zinc-100">What needs your attention?</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">Ask about delivery risk, fleet balance, operational issues, or telemetry signals.</p>
                  </div>
                  <AiPresetChips onSelectPrompt={(prompt) => void submitPrompt(prompt)} />
                </div>
              )}

              <div className="space-y-5">
                {messages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    {message.role === "user" ? (
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-emerald-500 px-4 py-3 text-sm leading-6 text-zinc-950 shadow-lg shadow-emerald-950/20">
                        {message.content}
                      </div>
                    ) : (
                      <AssistantResponse response={message.response} onCitationClick={handleCitationClick} />
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                      <Bot className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
                      <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-emerald-300" /> Checking operations...</span>
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div className="flex items-start gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p>{errorMessage}</p>
                      <button type="button" onClick={() => setErrorMessage(null)} className="mt-2 text-xs font-semibold text-rose-300 underline underline-offset-2">Dismiss</button>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <footer className="border-t border-zinc-800/80 bg-zinc-900/60 p-4">
              {lastUsage && (
                <div className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  <Command className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                  <span>{lastUsage.total_tokens} tokens</span>
                  <span className="text-zinc-700">/</span>
                  <span>{formatCost(lastUsage.estimated_cost_usd)}</span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-950 p-2 shadow-inner shadow-black/30 focus-within:border-emerald-400/50">
                <textarea
                  ref={inputRef}
                  value={inputPrompt}
                  onChange={(event) => setInputPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitPrompt(inputPrompt);
                    }
                  }}
                  rows={2}
                  maxLength={1000}
                  placeholder="Ask about your operations..."
                  aria-label="Ask LogiFlow Copilot"
                  className="min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-zinc-100 outline-none placeholder:text-zinc-600"
                />
                <button
                  type="submit"
                  disabled={isLoading || inputPrompt.trim().length < 3}
                  aria-label={isLoading ? "Copilot is working" : "Send prompt"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-zinc-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  {isLoading ? <CircleStop className="h-4 w-4" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                </button>
              </form>
              <p className="mt-2 text-[10px] text-zinc-600">Enter to send · Shift + Enter for a new line</p>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}

interface AssistantResponseProps {
  response: AiCopilotResponse;
  onCitationClick: (citation: AiCitation) => void;
}

function AssistantResponse({ response, onCitationClick }: AssistantResponseProps) {
  return (
    <div className="w-full max-w-[94%] space-y-3 sm:max-w-[88%]">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 rounded-2xl rounded-tl-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm leading-6 text-zinc-200">
          {response.answer.split(/\n+/).map((paragraph, index) => (
            <p key={`${paragraph}-${index}`} className={index > 0 ? "mt-3" : undefined}>{paragraph}</p>
          ))}
        </div>
      </div>

      {response.citations.length > 0 && (
        <div className="ml-11 flex flex-wrap gap-2">
          {response.citations.map((citation) => (
            <AiCitationBadge key={`${citation.type}-${citation.id}`} citation={citation} onCitationClick={onCitationClick} />
          ))}
        </div>
      )}

      <details className="ml-11 rounded-xl border border-zinc-800/80 bg-zinc-900/40 text-xs text-zinc-400">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 font-semibold text-zinc-500 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Response details</span>
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </summary>
        <div className="grid grid-cols-2 gap-3 border-t border-zinc-800/80 px-3 py-3 sm:grid-cols-4">
          <Metric label="Confidence" value={formatConfidence(response.confidence)} />
          <Metric label="Tools" value={response.tools_used.length ? String(response.tools_used.length) : "None"} />
          <Metric label="Tokens" value={String(response.usage.total_tokens)} />
          <Metric label="Cost" value={formatCost(response.usage.estimated_cost_usd)} />
        </div>
        {response.tools_used.length > 0 && (
          <div className="border-t border-zinc-800/80 px-3 py-3">
            <p className="mb-2 font-semibold uppercase tracking-[0.12em] text-zinc-600">Executed tools</p>
            <div className="flex flex-wrap gap-1.5">
              {response.tools_used.map((tool) => <span key={tool} className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] text-emerald-300">{tool}</span>)}
            </div>
          </div>
        )}
      </details>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">{label}</p>
      <p className="mt-1 font-semibold text-zinc-300">{value}</p>
    </div>
  );
}
