"use client";

import { useState, type MouseEvent } from "react";
import { useParams } from "next/navigation";
import { createApiClient } from "@/lib/api/apiClient";
import { buildTenantAwarePath, isTenantSubdomainActive } from "@/lib/tenant-routing";

/**
 * LogoutButton.tsx
 *
 * Premium, dark-themed logout control for the cockpit dashboard header.
 *
 * On activation it performs a stateful `POST /api/v1/auth/logout` against the
 * Laravel Sanctum database kernel through the tenant-aware `createApiClient`
 * wrapper. On success it:
 *   1. Clears localized data states (localStorage / sessionStorage).
 *   2. Flushes browser cache variables (sessionStorage keys, cached response
 *      mirrors kept by the client).
 *   3. Hard-navigates back to the tenant login perimeter via
 *      `window.location.assign("/<tenant>/login")`.
 *
 * Fail-closed semantics: if the logout POST does not return a success status,
 * the operator is never dropped out mid-flight; instead an error is surfaced
 * and control is retained so the session can be re-attempted.
 */
export function LogoutButton() {
  const params = useParams();
  const tenant = (params?.tenant as string) || "";

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Clears all browser-local identity/work session artifacts.
   */
  function flushLocalSessionState(): void {
    try {
      localStorage.clear();
    } catch {
      // Storage may be disabled in hardened/browser-restricted contexts.
    }

    try {
      sessionStorage.clear();
    } catch {
      // Storage may be disabled in hardened/browser-restricted contexts.
    }

    // Flush cached dispatch/live-sync mirrors that were carried in memory.
    if (typeof window !== "undefined") {
      const cacheKeysToDelete: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const key = window.sessionStorage.key(i);
        if (key) cacheKeysToDelete.push(key);
      }
      if (window.sessionStorage) {
        cacheKeysToDelete.forEach((key) => window.sessionStorage.removeItem(key));
      }
    }
  }

  /**
   * Constructs a clean, deterministic login target — never "/null/login".
   */
  function buildLoginPath(): string {
    const cleaned = String(tenant ?? "").trim();
    const currentHostname = typeof window !== "undefined" ? window.location.hostname : "";

    if (!cleaned || cleaned === "null" || cleaned === "undefined") {
      return "/login";
    }

    if (isTenantSubdomainActive(currentHostname, cleaned)) {
      return "/login";
    }

    return buildTenantAwarePath("/login", cleaned);
  }

  async function handleLogout(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    event.preventDefault();
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setErrorMessage(null);

    try {
      // The Next.js frontend runs on port 3000, but the Laravel Sanctum backend
      // kernel (which owns the /api/v1/auth/logout route) is served on port 8000.
      // `createApiClient()` defaults to `window.location.host` (port 3000), which
      // would 404 on the Next.js server. Build the backend base URL explicitly,
      // mirroring the proven login-page pattern, so the stateful logout POST
      // reaches the actual Laravel database kernel.
      const currentHostname = window.location.hostname;
      const currentProtocol = window.location.protocol;
      const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000`;

      // Tenant-aware factory still injects X-Tenant-ID (+ XSRF when present) and
      // sends the stateful Sanctum session cookie via credentials: "include".
      const client = createApiClient({
        baseUrl: `${backendBaseUrl}/api/v1`,
      });
      const response = await client.post<{ message: string }>("/auth/logout");

      if (response.status === 200) {
        flushLocalSessionState();

        // Drop the operator cleanly outside the corporate wall. Full page
        // navigation (not router.push) guarantees all client components and
        // any lingering WebSocket/Reverb subscriptions are torn down.
        const loginPath = buildLoginPath();
        window.location.assign(loginPath);
        return;
      }

      setErrorMessage(
        `Logout request was not accepted by the security kernel (${response.status}).`,
      );
      setIsLoggingOut(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Logout failed. Your session was not terminated.",
      );
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-label="Log out of this workspace"
        title="Terminate session and return to login"
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3.5 py-2 text-xs font-medium text-zinc-400 transition-all duration-200 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
      >
        {isLoggingOut ? (
          <>
            <svg
              className="h-3.5 w-3.5 animate-spin text-rose-400"
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
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Destroying session profile...</span>
          </>
        ) : (
          <>
            <svg
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </>
        )}
      </button>

      {errorMessage && (
        <p
          role="alert"
          className="max-w-[220px] text-right text-[10px] leading-snug text-rose-400/80"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}