"use client";

import { useState, type FormEvent } from "react";

/**
 * Public Onboarding Workspace Locator.
 *
 * Phase 1 — Workspace Identity & Accessibility.
 *
 * This component performs a *preflight* verification against the Laravel backend
 * before trusting any user-supplied handle. It resolves the requested tenant
 * through the port-8000 Nginx proxy gateway using the `X-Tenant-ID` header, and
 * only then redirects the browser to the tenant's secure login perimeter domain.
 *
 * The root landing host (`localhost` / `logiflow.app`) has no resolvable tenant
 * slug, so we deliberately use a native `fetch` layer instead of `createApiClient`
 * (which throws `TenantContextNotResolvedError` on root hosts). Credentials are
 * passed cross-origin so stateful Sanctum cookies are attached natively.
 */

/** Backend gateway port for the Laravel/Nginx proxy (Dev/Docker). */
const BACKEND_GATEWAY_PORT = 8000;

/** Endpoint used to validate a tenant handle before redirect. */
const TENANT_CURRENT_PATH = "/api/v1/tenants/current";

/** Friendly runtime labels surfaced to the operator. */
const STATUS_IDLE = "idle";
const STATUS_VERIFYING = "verifying";
const STATUS_ERROR = "error";

type VerifyStatus = typeof STATUS_IDLE | typeof STATUS_VERIFYING | typeof STATUS_ERROR;

export default function RootLandingPage() {
  const [orgHandle, setOrgHandle] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [status, setStatus] = useState<VerifyStatus>(STATUS_IDLE);

  /** Normalize a raw handle into a safe tenant slug. */
  function slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Derive the tenant's secure login perimeter URL from the current origin,
   * swapping only the hostname label so protocol + port are preserved.
   *
   *  - local dev:   http://localhost:3001  ->  http://acme.localhost:3001
   *  - production:  https://logiflow.app   ->  https://acme.logiflow.app
   */
  function buildTenantPerimeterUrl(slug: string): string {
    const current = new URL(window.location.href);
    const hostname = current.hostname;
    const port = current.port ? `:${current.port}` : "";
    const nextHostname = `${slug}.${hostname}`;
    return `${current.protocol}//${nextHostname}${port}/login`;
  }

  /**
   * Preflight handle verification.
   *
   * On success the browser is redirected to the tenant's login perimeter.
   * On any failure (404, 5xx, network timeouts) a friendly error is surfaced —
   * never a raw stack trace.
   */
  async function verifyWorkspace(slug: string): Promise<boolean> {
    const current = window.location;
    const gatewayBaseUrl = `${current.protocol}//${current.hostname}:${BACKEND_GATEWAY_PORT}`;
    const verificationUrl = `${gatewayBaseUrl}${TENANT_CURRENT_PATH}`;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(verificationUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Tenant-ID": slug,
        },
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok) {
        return false;
      }

      const envelope = (await response.json()) as {
        data?: { id?: number; slug?: string };
      };

      // Double-check the backend echoed the canonical slug we expect before
      // trusting the redirect target.
      if (!envelope?.data || !envelope.data.slug) {
        return false;
      }

      window.location.assign(buildTenantPerimeterUrl(envelope.data.slug));
      return true;
    } catch (error) {
      console.error("[Workspace Locator] Verification failed:", error);
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (status === STATUS_VERIFYING) return;

    const slug = slugify(orgHandle);
    if (!slug) {
      setValidationError("Enter your organization's workspace handle to continue.");
      return;
    }

    setValidationError(null);
    setStatus(STATUS_VERIFYING);

    const verified = await verifyWorkspace(slug);

    // If verification succeeded, the browser is already navigating away.
    if (!verified) {
      setStatus(STATUS_ERROR);
      setValidationError(
        "We couldn't find an active workspace for that handle. Please verify the spelling and try again.",
      );
    }
  }

  const isVerifying = status === STATUS_VERIFYING;

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
          className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-emerald-500/50 via-transparent to-indigo-500/30 transition-opacity duration-500 ${
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
                    onChange={(e) => {
                      setOrgHandle(e.target.value);
                      if (status === STATUS_ERROR) setValidationError(null);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="acme-logistics"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    disabled={isVerifying}
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
                    <path
                      d="M7 4v3M7 10h.01"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  {validationError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:from-emerald-300 hover:to-emerald-400 hover:shadow-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isVerifying ? (
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
                    Verifying Workspace…
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </span>
              {/* Hover shimmer */}
              <div className="absolute inset-0 -translate-x-full skew-x-12 bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
            </button>
          </form>

          {/* Footer hint */}
          <p className="mt-6 text-center text-xs text-zinc-600">
            Need help?{" "}
            <a
              href="#"
              className="underline underline-offset-2 transition-colors hover:text-zinc-400"
            >
              Contact your administrator
            </a>
          </p>
        </div>
      </div>

      {/* ── Bottom subtle version info ── */}
      <div className="absolute bottom-6 text-center text-xs text-zinc-700">
        <a
          href="/register"
          className="font-medium text-zinc-500 transition-colors hover:text-emerald-400"
        >
          Want to launch LogiFlow for your logistics company? Register a new workspace →
        </a>
        <p className="mt-2">LogiFlow v2.4.1 · Operations Cockpit</p>
      </div>
    </div>
  );
}
