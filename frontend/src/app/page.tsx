"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function RootLandingPage() {
  const router = useRouter();
  const [orgHandle, setOrgHandle] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = slugify(orgHandle);
    if (!slug) {
      setValidationError("Enter your organization's workspace handle to continue.");
      return;
    }
    setValidationError(null);
    router.push(`/${slug}/dashboard`);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 text-zinc-100">
      {/* ── Ambient background texture & glow ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 40%, rgba(16, 185, 129, 0.08) 0%, transparent 40%),
                            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.06) 0%, transparent 40%),
                            radial-gradient(circle, #27272a 1px, transparent 1px)`,
          backgroundSize: "100% 100%, 100% 100%, 20px 20px",
        }}
      />

      {/* ── Floating geometric accent ── */}
      <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* ── Subtle logo / brand mark ── */}
      <div className="relative mb-10 flex items-center gap-2">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          className="text-emerald-400"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M16 4L28 10V22L16 28L4 22V10L16 4ZM16 20L22 17V11L16 14L10 11V17L16 20Z"
            fill="currentColor"
            className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          />
        </svg>
        <span className="text-sm font-semibold tracking-widest text-zinc-400">
          LOGIFLOW
        </span>
      </div>

      {/* ── Main card – glass‑morphism with animated border ── */}
      <div className="relative w-full max-w-md">
        {/* Animated border ring on focus */}
        <div
          className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-emerald-500/50 via-transparent to-indigo-500/30 opacity-0 transition-opacity duration-500 ${
            isFocused ? "opacity-100" : "opacity-0"
          }`}
          style={{ filter: "blur(8px)" }}
          aria-hidden="true"
        />

        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          {/* Heading with subtle animation */}
          <div className="mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Enter your organization handle to open the operations cockpit.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label
                htmlFor="org-handle"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
              >
                Workspace handle
              </label>
              <div
                className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
                  validationError
                    ? "border-rose-500/60"
                    : isFocused
                    ? "border-emerald-500/60 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]"
                    : "border-zinc-800/60 hover:border-zinc-700/80"
                }`}
              >
                {/* Inner glow on focus */}
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent transition-opacity duration-300 ${
                    isFocused ? "opacity-100" : "opacity-0"
                  }`}
                />
                <div className="relative flex items-center">
                  <input
                    id="org-handle"
                    type="text"
                    value={orgHandle}
                    onChange={(e) => setOrgHandle(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="acme-logistics"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full bg-zinc-950/80 px-4 py-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                  />
                  <span className="border-l border-zinc-800/60 px-4 py-3.5 font-mono text-xs text-zinc-600 transition-colors duration-300 group-hover:text-zinc-500">
                    .logiflow.app
                  </span>
                </div>
              </div>

              {/* Animated error message */}
              {validationError && (
                <p
                  role="alert"
                  className="mt-2.5 flex items-center gap-1.5 text-sm text-rose-400 animate-in slide-in-from-top-2 duration-300"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    className="shrink-0 text-rose-400"
                  >
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 4v3M7 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {validationError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:from-emerald-300 hover:to-emerald-400 hover:shadow-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 active:scale-[0.98]"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Go to Space
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                >
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {/* Hover shimmer */}
              <div className="absolute inset-0 -translate-x-full skew-x-12 bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
            </button>
          </form>

          {/* Footer hint */}
          <p className="mt-6 text-center text-xs text-zinc-600">
            Need help?{" "}
            <a href="#" className="underline underline-offset-2 transition-colors hover:text-zinc-400">
              Contact your administrator
            </a>
          </p>
        </div>
      </div>

      {/* ── Bottom subtle version info ── */}
      <p className="absolute bottom-6 text-xs text-zinc-700">
        LogiFlow v2.4.1 · Operations Cockpit
      </p>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}