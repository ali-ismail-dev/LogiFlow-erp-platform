"use client";

import { useEffect, useState } from "react";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import type { Dispatch, LedgerLogEntry, OperationalMetrics } from "@/types/logistics";
import { MetricsFeed } from "./metrics-feed";
import { DispatchBoard } from "./dispatch-board";
import { MonitoringSidebar } from "./monitoring-sidebar";
import { getBroadcastingAuthUrl } from "@/lib/reverb-auth";

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
}: DashboardLiveSyncProps) {
  const [dispatches, setDispatches] = useState<Dispatch[]>(initialDispatches);
  const [metrics, setMetrics] = useState<OperationalMetrics>(initialMetrics);

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

        const activeDriversCount = next.filter((d) => {
          const s = String(d.status).toLowerCase();
          return s === "in_transit" || s === "delayed" || s === "picked_up" || s === "out_for_delivery";
        }).length;

        setMetrics({
          total_dispatches: next.length,
          pending_stops: next.reduce((acc, curr) => acc + (curr.stops?.filter((s) => String(s.status).toLowerCase() === "pending").length || 0), 0),
          live_delays: next.filter((d) => String(d.status).toLowerCase() === "delayed").length,
          active_drivers: activeDriversCount,
        });

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
      <aside className="lg:col-span-3">
        <MetricsFeed initialMetrics={metrics} />
      </aside>
      <section className="lg:col-span-6">
        <DispatchBoard initialDispatches={dispatches} />
      </section>
      <aside className="lg:col-span-3">
        <MonitoringSidebar dispatches={dispatches} initialEntries={initialEntries} />
      </aside>
    </div>
  );
}
