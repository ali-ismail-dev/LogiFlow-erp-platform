import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LogiFlow | Enterprise Logistical Command Core",
  description:
    "Next-generation supply chain telemetry optimization and self-serve multi-tenant cloud organization deployment hubs.",
};

const featureItems = [
  {
    title: "Real-Time Televerb Radar",
    description:
      "Sub-second fleet movement broadcasts with live geospatial overlays and predictive ETA recalibration.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="text-cyan-400"
      >
        <path
          d="M12 3a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9a9 9 0 0 1 0-18Zm0 2a7 7 0 0 0 0 14 7 7 0 0 0 0-14Z"
          fill="currentColor"
          opacity="0.4"
        />
        <path
          d="M12 8v4l3 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Multi-Tenant Firewalls",
    description:
      "Air-gapped corporate partition isolation with cryptographic tenant boundary enforcement and role-based access control.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="text-emerald-400"
      >
        <path
          d="M12 3 4 6v5c0 5.05 3.41 9.76 8 10 4.59-.24 8-4.95 8-10V6l-8-3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 12.5 11 14l3.5-3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Staged Inbound Ingestion",
    description:
      "Manual cargo tracking and automated stop compilation for streamlined warehouse receiving, cross-dock, and final-mile orchestration.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="text-amber-400"
      >
        <path
          d="M4 7h16M7 12h10m-7 5h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="5" cy="7" r="1.5" fill="currentColor" />
        <circle cx="7" cy="12" r="1.5" fill="currentColor" />
        <circle cx="10" cy="17" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
];

export default function RootLandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-50">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)",
          }}
        />
        <div
          className="absolute right-0 top-1/3 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(34,211,238,0.15), transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)",
          }}
        />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #71717a 1px, transparent 1px), linear-gradient(to bottom, #71717a 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:py-32">
        {/* Hero Section */}
        <section className="text-center">
          <div className="mb-6 flex items-center justify-center gap-2">
            <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              Enterprise Logistics Command Core
            </span>
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              Command Your Entire Supply Chain
            </span>
            <span className="mt-2 block text-zinc-200">
              from a single dark cockpit
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            LogiFlow unifies fleet telemetry, multi-tenant isolation, and cargo
            orchestration into one audacious command surface built for speed and
            operational certainty.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-6 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:from-emerald-300 hover:to-emerald-400 hover:shadow-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform duration-300 group-hover:-translate-x-1"
              >
                <path
                  d="M13 8H3m4 4-4-4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Provision New Workspace
            </a>
            <a
              href="/login"
              className="group inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-zinc-900/60 px-6 py-3.5 text-sm font-medium text-cyan-300 backdrop-blur transition-all duration-300 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-200 *:focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              Access Existing Cockpit
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>

        </section>

        {/* Feature Grid */}
        <section id="features" className="mt-24 scroll-mt-24">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100">
              Built for the relentless pace of logistics
            </h2>
            <p className="mt-3 text-zinc-400">
              Purpose-built modules that eliminate friction across every leg of
              your operation.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featureItems.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-8 backdrop-blur transition-all duration-300 hover:border-zinc-700/80 hover:bg-zinc-900/80 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.25)]"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/80 shadow-inner">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-zinc-100">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {feature.description}
                </p>
                <div className="absolute inset-x-0 bottom-0 h-1 rounded-b-2xl bg-gradient-to-r from-emerald-400/60 to-cyan-400/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </section>

        {/* Onboarding Action Gate Callout */}
        <section className="mt-24">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-12 text-center backdrop-blur">
            <div
              className="absolute inset-0 opacity-20"
              
            />
            <div className="relative">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
                Ready to take command?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-zinc-400">
                Launch your corporate operations cockpit in minutes. Secure,
                multi-tenant, and tuned for high-velocity logistics.
              </p>
              <a
                href="/register"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-cyan-400 to-cyan-500 px-8 py-4 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:from-cyan-300 hover:to-cyan-400 hover:shadow-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
              >
                Launch your corporate operations cockpit. Register a new
                workspace →
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}