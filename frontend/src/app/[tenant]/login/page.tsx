"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { createApiClient } from "@/lib/api/apiClient";

export default function TenantLoginPage() {
  const params = useParams();
  const tenant = (params?.tenant as string) || "unknown";
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFocusedField, setIsFocusedField] = useState<string | null>(null);

  function formatTenantName(slug: string): string {
    return slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    // Once a successful redirect is initiated, keep the button in its loading/
    // disabled state until the navigation completes and this component unmounts.
    let redirectStarted = false;

    try {
      const currentHostname = window.location.hostname;
      const currentProtocol = window.location.protocol;
      const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000`;

      const client = createApiClient({
        baseUrl: `${backendBaseUrl}/api/v1`
      });

      // 1. Trigger the stateful CSRF cookie handshake block on port 8000
      const csrfUrl = `${backendBaseUrl}/sanctum/csrf-cookie`;
      console.log(`[Auth Ingress] Requesting CSRF tokens from: ${csrfUrl}`);
      
      const csrfResponse = await fetch(csrfUrl, { credentials: "include" });
      if (!csrfResponse.ok) {
        throw new Error(`CSRF boundary handshake failed: ${csrfResponse.status}`);
      }

      // 2. Issue the login POST. The browser will now automatically attach the 
      // cookie payload natively due to our updated SESSION_DOMAIN rules!
      const response = await client.post<any>("/auth/login", {
        email,
        password,
      });

      if (response.status === 200) {
        console.log("[Auth Ingress] Security handshake verified. Redirecting to workspace...");
        // Mark that navigation has been initiated so the button remains in its
        // loading state throughout the page transition, not just during the request.
        redirectStarted = true;
        router.push(`/${tenant}/dashboard`);
        return;
      } else {
        // Surface the backend's actual error when available (e.g. validation
        // errors, CSRF failures, tenant boundary violations) instead of a
        // generic message that masks the real cause.
        const backendMessage =
          (response.data as any)?.message ?? (response.data as any)?.errors?.email?.[0];
        setErrorMessage(
          backendMessage ?? "Invalid credentials for this organization workspace.",
        );
      }
    } catch (error: any) {
      console.error("[Auth Ingress] Exception caught:", error);
      if (error?.response?.data?.message) {
        setErrorMessage(error.response.data.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Authentication gateway timeout. Verification failed.");
      }
    } finally {
      // Only re-enable the button if we did NOT trigger a navigation. When a
      // redirect is in flight, leave isSubmitting true so the button stays
      // disabled and shows the loading spinner until the component unmounts.
      if (!redirectStarted) {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 40%, rgba(16, 185, 129, 0.08) 0%, transparent 40%),
                            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.06) 0%, transparent 40%),
                            radial-gradient(circle, #27272a 1px, transparent 1px)`,
          backgroundSize: "100% 100%, 100% 100%, 20px 20px",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          
          <div className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Gateway Perimeter
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
              {formatTenantName(tenant)} Hub
            </h2>
            <p className="mt-2 text-xs text-zinc-400">
              Sign in with your corporate credentials to unlock this workstation cockpit.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-400"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0 text-rose-400">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 4v3M7 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Corporate Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsFocusedField("email")}
                onBlur={() => setIsFocusedField(null)}
                placeholder="operator@logiflow.test"
                disabled={isSubmitting}
                className={`w-full rounded-xl border bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none ${
                  isFocusedField === "email" ? "border-emerald-500/60 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]" : "border-zinc-800/60 hover:border-zinc-700/80"
                }`}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Access Token Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsFocusedField("password")}
                onBlur={() => setIsFocusedField(null)}
                placeholder="••••••••"
                disabled={isSubmitting}
                className={`w-full rounded-xl border bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none ${
                  isFocusedField === "password" ? "border-emerald-500/60 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]" : "border-zinc-800/60 hover:border-zinc-700/80"
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`group relative w-full overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200
                ${isSubmitting
                  ? "cursor-not-allowed bg-zinc-800 text-zinc-400 shadow-none"
                  : "cursor-pointer bg-gradient-to-b from-emerald-400 to-emerald-500 text-zinc-950 shadow-lg hover:from-emerald-300 hover:to-emerald-400 active:scale-[0.99]"
                }`}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isSubmitting && (
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
                      className="opacity-90"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
                {isSubmitting ? "Verifying Identity..." : "Authenticate Session"}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
