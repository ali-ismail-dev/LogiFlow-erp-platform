import type { Dispatch, OperationalMetrics, LedgerLogEntry } from "@/types/logistics";
import type { AuthUser } from "@/hooks/useRBAC";
import { headers } from "next/headers";
import { DashboardLiveSync } from "../../../components/dashboard/DashboardLiveSync";
import { DashboardSecurityBoundary } from "../../../components/dashboard/DashboardSecurityBoundary";
import {
  fetchLogiflow,
  MissingLogiflowServiceTokenError,
} from "@/lib/server/logiflow-fetch";

class MissingTenantContextError extends Error {
  constructor(tenantSlug: string) {
    super(
      `Tenant context could not be resolved for "${tenantSlug}". ` +
        "The RSC fetch to /api/v1/tenants/current did not return a tenant. " +
        "Verify that LOGIFLOW_RSC_SERVICE_TOKEN is present and scoped to this tenant.",
    );
    this.name = "MissingTenantContextError";
  }
}

interface DashboardPageProps {
  params: { tenant: string };
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
      const res = await fetchLogiflow(`${baseUrl}${path}`, {
        tenant,
        headers: {
          "Accept": "application/json",
        },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(3000)
      });

      if (res.ok) {
        const envelope = await res.json();
        return envelope.data;
      }
    } catch (err) {
      if (err instanceof MissingLogiflowServiceTokenError) {
        throw err;
      }

      // Pass down cleanly to next proxy fallback link
    }
  }
  return null;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { tenant } = params;

  const host = headers().get("host") ?? "";
  const subdomain = host.split(":")[0].split(".")[0];

  if (subdomain && subdomain !== tenant) {
    throw new MissingTenantContextError(tenant);
  }

  // Hydrate dispatches, tenant context, and users concurrently with the RSC service token.
  // The authenticated human user is resolved exclusively on the client by useRBAC / DashboardLiveSync.
  const [dispatches, tenantInfo, usersRoster] = await Promise.all([
    fetchFromBackend<Dispatch[]>(tenant, "/api/v1/dispatches"),
    fetchFromBackend<{ id: number; slug: string }>(tenant, "/api/v1/tenants/current"),
    fetchFromBackend<AuthUser[]>(tenant, "/api/v1/users"),
  ]);

  const resolvedDispatches = dispatches || [];
  const resolvedUsers = usersRoster || [];
  if (!tenantInfo) {
    throw new MissingTenantContextError(tenant);
  }
  const resolvedTenantId = String(tenantInfo.id);

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
        <main>
          <DashboardLiveSync
            initialDispatches={resolvedDispatches}
            initialMetrics={metrics}
            initialEntries={ledgerEntries}
            tenantSlug={tenant}
            tenantId={resolvedTenantId}
            authUser={null}
            usersRoster={resolvedUsers}
          />
        </main>
      </div>
    </DashboardSecurityBoundary>
  );
}