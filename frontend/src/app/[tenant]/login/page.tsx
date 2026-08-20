"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createApiClient } from "@/lib/api/apiClient";
import { buildTenantAwarePath } from "@/lib/tenant-routing";

export default function TenantLoginPage() {
  const params = useParams();
  const tenant = (params?.tenant as string) || "unknown";
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFocusedField, setIsFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

    let redirectStarted = false;

    try {
      // Dynamically build the backend base URL to preserve cookie sharing boundaries across subdomains:
      const currentHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const currentProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000`;

      const client = createApiClient({
        baseUrl: `${backendBaseUrl}/api/v1`,
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
        console.log(
          "[Auth Ingress] Security handshake verified. Redirecting to workspace...",
        );

        const userRole = String(
          response.data?.data?.role ?? response.data?.user?.role ?? "",
        ).toLowerCase();

        const carriesSubdomain =
          currentHostname === tenant || currentHostname.startsWith(`${tenant}.`);

        const targetDashboardPath = carriesSubdomain
          ? "/dashboard"
          : buildTenantAwarePath("/dashboard", tenant);

        const targetDriverPath = carriesSubdomain
          ? "/driver/dashboard"
          : buildTenantAwarePath("/driver/dashboard", tenant);

        redirectStarted = true;
        if (userRole === "driver") {
          router.push(targetDriverPath);
        } else {
          router.push(targetDashboardPath);
        }
        return;
      } else {
        const backendMessage =
          (response.data as any)?.message ??
          (response.data as any)?.errors?.email?.[0];
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
      if (!redirectStarted) {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-6 text-zinc-100">
      {/* Ambient radial backdrops */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 40%, rgba(16, 185, 129, 0.08) 0%, transparent 40%),
                            radial-gradient(circle at 20% 80%, rgba(34, 211, 238, 0.06) 0%, transparent 40%),
                            radial-gradient(circle, #27272a 1px, transparent 1px)`,
          backgroundSize: "100% 100%, 100% 100%, 20px 20px",
        }}
      />
      {/* Additional glow */}
      <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {/* Brand mark */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-lg shadow-emerald-500/10">
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

          <div className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Gateway Perimeter
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
              {formatTenantName(tenant)} Workspace Portal
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Sign in with your corporate credentials to unlock this workstation cockpit.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-950/60 px-3 py-1 text-[10px] font-mono text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {tenant}.localhost:3000
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-400"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="mt-0.5 shrink-0 text-rose-400"
              >
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M7 4v3M7 10h.01"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
              >
                Corporate Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 3h10v8H2V3Zm10 0L7 7 2 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
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
                  className={`w-full rounded-xl border bg-zinc-950/80 py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none ${
                    isFocusedField === "email"
                      ? "border-emerald-500/60 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]"
                      : "border-zinc-800/60 hover:border-zinc-700/80"
                  }`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
              >
                Access Token Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="2.5" y="5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M4.5 5V3.5a2.5 2.5 0 015 0V5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsFocusedField("password")}
                  onBlur={() => setIsFocusedField(null)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={`w-full rounded-xl border bg-zinc-950/80 py-3 pl-10 pr-10 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none ${
                    isFocusedField === "password"
                      ? "border-emerald-500/60 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]"
                      : "border-zinc-800/60 hover:border-zinc-700/80"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-zinc-400"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7s2-3 5-3 5 3 5 3-2 3-5 3-5-3-5-3Z" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7s2-3 5-3 5 3 5 3-2 3-5 3-5-3-5-3Z" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M3 3l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`group relative w-full overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                isSubmitting
                  ? "cursor-not-allowed bg-zinc-800 text-zinc-400 shadow-none"
                  : "cursor-pointer bg-gradient-to-b from-emerald-400 to-emerald-500 text-zinc-950 shadow-lg hover:from-emerald-300 hover:to-emerald-400 active:scale-[0.99]"
              }`}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isSubmitting && (
                  <svg
                    className="h-4 w-4 animate-spin text-emerald-400"
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
                {isSubmitting
                  ? "Authenticating profile session..."
                  : "Authenticate Session"}
              </span>
              {!isSubmitting && (
                <div className="absolute inset-0 -translate-x-full skew-x-12 bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}