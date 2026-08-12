"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import type { Dispatch, LedgerLogEntry, OperationalMetrics } from "@/types/logistics";
import { useRBAC, ROLE_LABELS, type AuthUser } from "@/hooks/useRBAC";
import { MetricsFeed } from "./metrics-feed";
import { DispatchBoard } from "./dispatch-board";
import { MonitoringSidebar } from "./monitoring-sidebar";
import { getBroadcastingAuthUrl } from "@/lib/reverb-auth";
import { buildTenantAwarePath } from "@/lib/tenant-routing";
import { LogoutButton } from "./LogoutButton";

type LiveDispatchEvent = {
  id: string | number;
  tenant_id: string | number;
  status: string;
  reference_number?: string;
  reference_code?: string;
  current_stop?: {
    id: string | number;
    sequence: number;
    label: string;
    status: string;
    eta: string | null;
  } | null;
  driver?: {
    id: string | number;
    name: string;
  } | null;
  vehicle_identifier?: string;
  driver_name?: string;
  updated_at: string | null;
};

interface DashboardLiveSyncProps {
  initialDispatches: Dispatch[];
  initialMetrics: OperationalMetrics;
  initialEntries: LedgerLogEntry[];
  tenantSlug: string;
  tenantId: string | number;
  authUser: AuthUser | null;
  // FIXED: The server-hydrated real database user roster. Forwarded to the
  // MonitoringSidebar so the Active Drivers list and the active_drivers metric
  // count both derive from the exact same source of truth (driver-role rows).
  usersRoster?: AuthUser[];
}

if (typeof window !== "undefined") {
  (window as any).Pusher = Pusher;
}

const REVERB_EVENT_NAME = ".dispatch.movement.updated";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function authorizeChannel(channelName: string, socketId: string, tenantSlug: string) {
  const response = await fetch(getBroadcastingAuthUrl(API_BASE_URL), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantSlug,
    },
    body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
  });

  if (!response.ok) {
    throw new Error(`Channel authorization failed (${response.status})`);
  }

  return response.json();
}

export function DashboardLiveSync({
  initialDispatches,
  initialMetrics,
  initialEntries,
  tenantSlug,
  tenantId,
  usersRoster = [],
}: DashboardLiveSyncProps) {
  const [dispatches, setDispatches] = useState<Dispatch[]>(initialDispatches);
  const [metrics, setMetrics] = useState<OperationalMetrics>(initialMetrics);

  const router = useRouter();

  // FIXED: Resolve the cockpit operative's identity and role natively in the browser
  // via the same client-side /auth/me handshake the Employees page uses (which is
  // proven to work — it carries the authenticated session cookie and resolves
  // super_admin). Passing the server-hydrated `authUser` (null over the internal
  // SSR network) and forcing skipFetch had been short-circuiting role resolution,
  // leaving the operative as "Guest" and suppressing the RBAC-gated Team Directory
  // button. With no injected user and no skip, useRBAC fetches the real session role.
  const currentUserRole = useRBAC();

  const activeOperativeLabel = currentUserRole.role ? ROLE_LABELS[currentUserRole.role] : "Guest Operative";

  console.debug(`[Dashboard] Active cockpit operative: ${activeOperativeLabel}`);

  useEffect(() => {
    const echo = new Echo({
      broadcaster: "reverb",
      key: process.env.NEXT_PUBLIC_REVERB_APP_KEY || "logiflow_key",
      wsHost: process.env.NEXT_PUBLIC_REVERB_HOST || "localhost",
      wsPort: 8000,
      wssPort: 8000,
      forceTLS: false,
      enabledTransports: ["ws", "wss"],
      authorizer: (channel: any) => {
        return {
          authorize: (socketId: string, callback: Function) => {
            authorizeChannel(channel.name, socketId, tenantSlug)
              .then((data) => callback(false, data))
              .catch((err) => callback(true, err));
          },
        };
      },
    });

    const resolvedTenantId = String(tenantId);

    console.log(`[WebSocket] Subscribing securely to private channel: tenant.${resolvedTenantId}.ops`);

    const channel = echo.private(`tenant.${resolvedTenantId}.ops`);

    channel.listen(REVERB_EVENT_NAME, (event: any) => {
      console.log("🚀 Real-Time Event Captured Cleanly:", event);

      const payload = event.dispatch ?? event;
      const incomingId = payload.id;

      if (!incomingId) return;

      setDispatches((prev) => {
        const index = prev.findIndex((d) => String(d.id) === String(incomingId));
        const existing = index === -1 ? undefined : prev[index];

        const nextDispatch = {
          ...(existing ?? {}),
          id: String(incomingId),
          tenant_id: String(payload.tenant_id ?? resolvedTenantId),
          status: payload.status ?? existing?.status ?? "in_transit",
          reference_code: payload.reference_code || payload.reference_number || existing?.reference_code || "DSP-MANIFEST",
          driver_name: payload.driver_name || payload.driver?.name || existing?.driver_name || "Assigned Driver",
          vehicle_identifier: payload.vehicle_identifier || payload.vehicle?.identifier || existing?.vehicle_identifier || "FLEET-VAN",
          departed_at: payload.departed_at || payload.created_at || existing?.departed_at || new Date().toISOString(),
          warehouse: payload.warehouse || existing?.warehouse || { id: "wh_01", name: "Nike Warehouse Hub", code: "NKE-WH", timezone: "UTC", latitude: 0, longitude: 0 },
          stops: payload.stops || existing?.stops || [],
        } as Dispatch;

        let next = index === -1 ? [nextDispatch, ...prev] : prev.map((d) => String(d.id) === String(incomingId) ? nextDispatch : d);

        // FIXED: Corrected mathematical array sorting subtraction to maintain pristine chronological layout ordering (Oldest on top)
        next.sort((a, b) => Number(a.id) - Number(b.id));

        // Calculate manifest‑specific operational metrics in real‑time
        const pendingStopsCount = next.reduce((acc, curr) => acc + (curr.stops?.filter((s) => String(s.status).toLowerCase() === "pending").length || 0), 0);
        const liveDelaysCount = next.filter((d) => String(d.status).toLowerCase() === "delayed").length;

        setMetrics((prevMetrics) => ({
          ...prevMetrics,
          total_dispatches: next.length,
          pending_stops: pendingStopsCount,
          live_delays: liveDelaysCount,
          // FIXED: Retain the true database‑backed driver count from server hydration
          // instead of blindly overwriting it with names extracted from live manifests.
          active_drivers: prevMetrics.active_drivers,
        }));

        return next;
      });
    });

    channel.error((error: unknown) => {
      console.error("[WebSocket] Subscription error", error);
    });

    return () => {
      channel.stopListening(REVERB_EVENT_NAME);
      echo.disconnect();
    };
  }, [tenantSlug, tenantId]);

  return (
    <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-12 lg:gap-6 lg:p-8">
      <div className="flex items-center justify-between gap-3 lg:col-span-12">
        <div className="flex items-center gap-3">
          {currentUserRole.can("invite_users") && (
            <button
              type="button"
              onClick={() => router.push(buildTenantAwarePath("/employees", tenantSlug))}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs font-semibold tracking-wide text-zinc-300 transition-all hover:border-zinc-700 hover:text-zinc-100"
            >
              Manage Team Directory →
            </button>
          )}
        </div>

        {/*
          Security perimeter control — lets the SuperAdmin terminate their own
          stateful session on command and drop cleanly back to the login gateway.
        */}
        <div className="flex items-center">
          <LogoutButton />
        </div>
      </div>
      <aside className="lg:col-span-3">
        <MetricsFeed initialMetrics={metrics} />
      </aside>
      <section className="lg:col-span-6">
        <DispatchBoard initialDispatches={dispatches} usersRoster={usersRoster} />
      </section>
      <aside className="lg:col-span-3">
        <MonitoringSidebar initialEntries={initialEntries} usersRoster={usersRoster} />
      </aside>
    </div>
  );
}