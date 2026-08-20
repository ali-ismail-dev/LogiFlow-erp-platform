"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

const API_URL = "http://localhost:8000/api/v1/public/register";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    company_name: "",
    admin_name: "",
    admin_email: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setTenantSlug(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          payload?.message ||
          payload?.errors?.[Object.keys(payload?.errors ?? {})[0]]?.[0] ||
          "We could not provision your company workspace. Please review the details and try again.";
        throw new Error(message);
      }

      const slug = payload?.data?.tenant?.slug;
      setTenantSlug(slug ?? null);
      setSuccessMessage(
        "Company space provisioned successfully! Transferring to your secure corporate workstation gateway...",
      );

      const targetUrl = slug
        ? `http://${slug}.localhost:3000/login`
        : "http://localhost:3000/login";

      window.setTimeout(() => {
        window.location.href = targetUrl;
      }, 2000);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "We could not provision your company workspace. Please review the details and try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="grid min-h-[760px] lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left Panel – LogiFlow Global SaaS Matrix */}
          <section className="relative overflow-hidden border-b border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950/20 p-8 lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.12),transparent_40%)]" />
            <div className="relative z-10">
              <div className="mb-10 flex items-center gap-3 text-sm font-semibold tracking-[0.22em] text-zinc-400 uppercase">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  L
                </span>
                LogiFlow Enterprise
              </div>

              <div className="max-w-xl">
                <p className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-emerald-300">
                  New workspace provisioning
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  Launch your logistics company into its own secure operations hub.
                </h1>
                <p className="mt-6 text-lg leading-8 text-zinc-300">
                  Spin up a dedicated tenant environment with a default central warehouse, role-based admin controls, and a fully isolated workspace for your team.
                </p>
              </div>

              {/* Auto-seeded components */}
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  ["Tenant Launch", "Instant workspace creation"],
                  ["Warehouse Seed", "Default hub auto-generated"],
                  ["Super Admin", "Immediate command access"],
                ].map(([title, body]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 backdrop-blur"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {title}
                    </p>
                    <p className="mt-3 text-sm text-zinc-200">{body}</p>
                  </div>
                ))}
              </div>

              {/* Additional SaaS Matrix note */}
              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  LogiFlow Global SaaS Matrix
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Every new workspace is provisioned with isolated network boundaries, encrypted tenant data, and a dedicated command interface.
                </p>
              </div>
            </div>
          </section>

          {/* Right Panel – Floating Card */}
          <section className="relative flex items-center justify-center p-8">
            {/* Subtle glow behind card */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/70 p-8 shadow-2xl shadow-black/60 backdrop-blur-xl">
              <div className="mb-8">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Corporate onboarding
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-white">
                  Register a new workspace
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="company_name"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Company Name
                  </label>
                  <input
                    id="company_name"
                    name="company_name"
                    type="text"
                    value={formData.company_name}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Northstar Logistics"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin_name"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Admin Full Name
                  </label>
                  <input
                    id="admin_name"
                    name="admin_name"
                    type="text"
                    value={formData.admin_name}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Jordan Wells"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin_email"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Corporate Email
                  </label>
                  <input
                    id="admin_email"
                    name="admin_email"
                    type="email"
                    value={formData.admin_email}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="admin@company.com"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Access Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={isPasswordVisible ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3 pr-12 text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10"
                      placeholder="Minimum 8 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setIsPasswordVisible((visible) => !visible)}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-zinc-500 transition-colors hover:text-cyan-300 focus:text-cyan-300 focus:outline-none"
                      aria-label={
                        isPasswordVisible ? "Hide password" : "Show password"
                      }
                      title={isPasswordVisible ? "Hide password" : "Show password"}
                    >
                      {isPasswordVisible ? (
                        <EyeOff className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    {successMessage}
                    {tenantSlug && (
                      <span className="mt-2 block text-xs text-emerald-300">
                        Workspace slug: {tenantSlug}
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-300 hover:to-emerald-400 hover:shadow-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {isSubmitting ? (
                      <>
                        <svg
                          className="h-5 w-5 animate-spin"
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
                        Provisioning workspace environment...
                      </>
                    ) : (
                      "Create company workspace"
                    )}
                  </span>
                  {!isSubmitting && (
                    <div className="absolute inset-0 -translate-x-full skew-x-12 bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
                  )}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}