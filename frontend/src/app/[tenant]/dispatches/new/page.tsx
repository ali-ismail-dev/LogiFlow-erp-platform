// frontend/src/app/[tenant]/dispatches/new/page.tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DispatchOrderForm, type DispatchFormPayload } from "@/components/dispatch/DispatchOrderForm";
import { createApiClient } from "@/lib/api/apiClient";

type SubmitState = "idle" | "success";

interface DispatchCreateResponse {
  id: string;
  reference_code: string;
}

export default function NewDispatchPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const isLocked = isSubmitting || submitState === "success";

  async function handleSubmit(payload: DispatchFormPayload) {
    if (isLocked) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const client = createApiClient(tenant);
      const response = await client.post<DispatchCreateResponse>("/dispatches", payload);

      if (response.status === 201) {
        setSubmitState("success");
        setTimeout(() => {
          router.push(`/${tenant}/dashboard`);
        }, 2000);
      } else {
        setErrorMessage("The dispatch could not be created. Review the manifest and try again.");
      }
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 px-6 py-10 text-zinc-100 lg:px-10">
      {/* ── Ambient background texture & glow ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 30% 10%, rgba(16, 185, 129, 0.08) 0%, transparent 40%),
                            radial-gradient(circle at 80% 90%, rgba(99, 102, 241, 0.06) 0%, transparent 40%),
                            radial-gradient(circle, #27272a 1px, transparent 1px)`,
          backgroundSize: "100% 100%, 100% 100%, 20px 20px",
        }}
      />
      {/* ── Floating geometric accent ── */}
      <div className="pointer-events-none absolute -top-20 left-1/3 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* ── Header ── */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/${tenant}/dashboard`}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to dashboard
            </Link>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              <span className="font-mono text-xs normal-case tracking-normal text-zinc-400">{tenant}</span>{" "}
              <span className="text-zinc-600">·</span> Dispatch Manifest
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
              New Dispatch
            </h1>
          </div>
          {/* Draft badge – subtle chip */}
          <span className="flex-none rounded-full border border-zinc-800/60 bg-zinc-900/50 px-3 py-1 text-xs font-medium text-zinc-500 backdrop-blur">
            Draft
          </span>
        </div>

        {/* ── Success / Error banners ── */}
        {submitState === "success" && (
          <div
            role="status"
            className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 animate-in slide-in-from-top-2 duration-500"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-emerald-400">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dispatch created. Redirecting you to the dashboard…
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 animate-in slide-in-from-top-2 duration-500"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-rose-400">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── Form Card ── */}
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
          {/* Loading overlay */}
          {isLocked && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-zinc-950/70 backdrop-blur-sm transition-all duration-300">
              <span className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-300 shadow-lg">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
                {submitState === "success" ? "Redirecting to dashboard…" : "Submitting manifest…"}
              </span>
            </div>
          )}

          <DispatchOrderForm onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
}

function resolveErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybeApiError = error as {
      response?: { data?: { message?: string; errors?: Record<string, string[]> } };
    };
    const data = maybeApiError.response?.data;

    if (data?.errors) {
      const firstField = Object.values(data.errors)[0];
      if (Array.isArray(firstField) && firstField.length > 0) {
        return firstField[0];
      }
    }
    if (data?.message) {
      return data.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong while creating the dispatch. Please try again.";
}