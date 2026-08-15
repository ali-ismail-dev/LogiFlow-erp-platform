import type { Dispatch, OperationalMetrics, LedgerLogEntry } from "@/types/logistics";
import type { AuthUser } from "@/hooks/useRBAC";
import { DashboardLiveSync } from "../../../components/dashboard/DashboardLiveSync";
import { DashboardSecurityBoundary } from "../../../components/dashboard/DashboardSecurityBoundary";

interface DashboardPageProps {
  params: { tenant: string };
}

function formatTenantName(tenant: string): string {
  if (!tenant) return "Logistics Workspace";
  return tenant
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Resilient Multi-Target Server-to-Server Fetcher
 *
 * Fetches data over the internal Docker network channel.
 */
async function fetchFromBackend<T>(tenant: string, path: string): Promise<T | null> {
  const urls = [
    process.env.INTERNAL_BACKEND_URL || "http://webserver",
    "http://localhost:8000"
  ];

  for (const baseUrl of urls) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: {
          "Accept": "application/json",
          "X-Tenant-ID": tenant,
        },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(3000)
      });

      if (res.ok) {
        const envelope = await res.json();
        return envelope.data;
      }
    } catch (err) {
      // Pass down cleanly to next proxy fallback link
    }
  }
  return null;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { tenant } = params;

  // Hydrate data concurrently. Note: /auth/me will return null over internal Docker network,
  // which is expected. The client-side hook will complete browser-level authentication.
  const [dispatches, tenantInfo, authUser, usersRoster] = await Promise.all([
    fetchFromBackend<Dispatch[]>(tenant, "/api/v1/dispatches"),
    fetchFromBackend<{ id: number; slug: string }>(tenant, "/api/v1/tenants/current"),
    fetchFromBackend<AuthUser>(tenant, "/api/v1/auth/me"),
    fetchFromBackend<AuthUser[]>(tenant, "/api/v1/users"),
  ]);

  const resolvedDispatches = dispatches || [];
  const resolvedUsers = usersRoster || [];
  const resolvedTenantId = tenantInfo ? String(tenantInfo.id) : "11";

  const metrics: OperationalMetrics = {
    total_dispatches: resolvedDispatches.length,
    pending_stops: resolvedDispatches.reduce((acc, d) => acc + (d.stops?.filter(s => String(s.status).toLowerCase() === "pending").length || 0), 0),
    live_delays: resolvedDispatches.filter(d => String(d.status).toLowerCase() === "delayed").length,
    active_drivers: resolvedUsers.filter(u => String(u.role).toLowerCase() === "driver").length,
  };

  const ledgerEntries: LedgerLogEntry[] = [];

  return (
    <DashboardSecurityBoundary tenant={tenant}>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-5 lg:px-8">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              Operations Cockpit
            </p>
            <h1 className="mt-1 text-xl font-semibold text-zinc-50">{formatTenantName(tenant)}</h1>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-zinc-800/60 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono tracking-tight">{tenant}</span>
            <span className="text-zinc-600">·</span>
            live session
          </div>
        </header>

        <main>
          <DashboardLiveSync
            initialDispatches={resolvedDispatches}
            initialMetrics={metrics}
            initialEntries={ledgerEntries}
            tenantSlug={tenant}
            tenantId={resolvedTenantId}
            authUser={authUser}
            usersRoster={resolvedUsers}
          />
        </main>
      </div>
    </DashboardSecurityBoundary>
  );
}
