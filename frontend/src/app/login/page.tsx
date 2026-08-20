"use client";

import { useState, type FormEvent } from "react";

export default function WorkspaceDiscoveryPage() {
  const [companySlug, setCompanySlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    type: "success" | "error";
  }>({ open: false, message: "", type: "success" });

  function showToast(message: string, type: "success" | "error") {
    setToast({ open: true, message, type });
    window.setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 3500);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedSlug = companySlug.trim().toLowerCase();

    if (!trimmedSlug) {
      showToast(
        "Please enter your workspace identifier to continue.",
        "error",
      );
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      showToast(
        "Workspace identifiers may only contain letters, numbers, and single hyphens.",
        "error",
      );
      return;
    }

    setIsSubmitting(true);
    showToast(`Locating ${trimmedSlug} workspace gateway...`, "success");

    window.setTimeout(() => {
      window.location.href = `http://${trimmedSlug}.localhost:3000/login`;
    }, 400);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-6 text-zinc-50">
      {/* Ambient radial glow background */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div
          className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.12), transparent 70%)",
          }}
        />
        <div
          className="absolute right-0 bottom-1/4 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl p-8 rounded-3xl max-w-md w-full shadow-2xl shadow-black/40">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 22 22"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M11 2L19 6.5V15.5L11 20L3 15.5V6.5L11 2ZM11 14L15 11.75V8.25L11 10.25L7 8.25V11.75L11 14Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Workspace Discovery Gateway
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">
              Find Your Workspace
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Enter your unique corporate identifier slug to access your secure
              administrative logistics cockpit.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label
                htmlFor="company-slug"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
              >
                Workspace Identifier / Company Slug
              </label>
              <div className="group relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950/80 transition-all duration-300 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-500/10">
                <input
                  id="company-slug"
                  type="text"
                  value={companySlug}
                  onChange={(event) => setCompanySlug(event.target.value)}
                  placeholder="e.g., nike"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={isSubmitting}
                  className="w-full bg-transparent px-4 py-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="pointer-events-none flex items-center border-t border-zinc-800/80 bg-zinc-900/60 px-4 py-2">
                  <span className="font-mono text-xs text-zinc-500">
                    .localhost:3000
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-cyan-400 to-cyan-500 px-4 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:from-cyan-300 hover:to-cyan-400 hover:shadow-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    Locating operational core...
                  </>
                ) : (
                  "Access Workspace"
                )}
              </span>
              {!isSubmitting && (
                <div className="absolute inset-0 -translate-x-full skew-x-12 bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-zinc-600">
            Need a new workspace?{" "}
            <a
              href="/register"
              className="text-cyan-400 underline underline-offset-2 transition-colors hover:text-cyan-300"
            >
              Register here
            </a>
          </p>
        </div>
      </div>

      {/* Toast notification */}
      {toast.open && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed bottom-6 right-6 z-[100] max-w-sm rounded-xl border shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out ${
            toast.type === "success"
              ? "border-emerald-500/50 bg-emerald-950/90 shadow-emerald-500/20"
              : "border-rose-500/50 bg-rose-950/90 shadow-rose-500/20"
          }`}
          style={{
            animation: "toast-in 0.3s cubic-bezier(0.21, 1.02, 0.73, 1)",
          }}
        >
          <div className="flex items-start gap-3 px-4 py-3">
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                toast.type === "success"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/20 text-rose-300"
              }`}
            >
              {toast.type === "success" ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6l2.5 2.5L10 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M3 3l6 6M9 3L3 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-100">
                {toast.type === "success" ? "Workspace Detected" : "Error"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast((prev) => ({ ...prev, open: false }))}
              className="ml-2 text-zinc-500 transition-colors hover:text-zinc-300"
              aria-label="Dismiss notification"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 3l8 8M11 3L3 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(1rem) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}