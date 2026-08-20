"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import type { Dispatch, LedgerLogEntry, OperationalMetrics } from "@/types/logistics";
import type { AuthUser } from "@/hooks/useRBAC";
import { MetricsFeed } from "./metrics-feed";
import { DispatchBoard } from "./dispatch-board";
import { MonitoringSidebar } from "./monitoring-sidebar";
import { OperationalControlBoard } from "./OperationalControlBoard";
import { createApiClient } from "@/lib/api/apiClient";

type LiveDispatchEvent = {
  id: string | number;
  tenant_id: string | number;
  status: string;
  reference_number?: string;
  reference_code?: string;
  driver?: { id: string | number; name: string } | null;
  driver_name?: string;
  vehicle_identifier?: string;
  created_at?: string;
  warehouse?: Dispatch["warehouse"];
  stops?: Dispatch["stops"];
};

interface DashboardLiveSyncProps {
  initialDispatches: Dispatch[];
  initialMetrics: OperationalMetrics;
  initialEntries: LedgerLogEntry[];
  tenantSlug: string;
  tenantId: string | number;
  authUser: AuthUser | null;
  usersRoster?: AuthUser[];
}

if (typeof window !== "undefined") {
  (window as any).Pusher = Pusher;
}

const REVERB_EVENT_NAME = ".dispatch.movement.updated";

async function authorizeChannel(channelName: string, socketId: string, tenantSlug: string) {
  const client = createApiClient({ baseUrl: `${window.location.protocol}//${window.location.hostname}:8000` });
  const response = await client.post<any>("/broadcasting/auth", {
    socket_id: socketId,
    channel_name: channelName,
  }, { headers: { "X-Tenant-ID": tenantSlug } });
  return response.data;
}

export function DashboardLiveSync({
  initialDispatches,
  initialMetrics,
  initialEntries,
  tenantSlug,
  tenantId,
  authUser: _authUser,
  usersRoster = [],
}: DashboardLiveSyncProps) {
  const [dispatches, setDispatches] = useState<Dispatch[]>(initialDispatches);
  const [metrics, setMetrics] = useState<OperationalMetrics>(initialMetrics);
  const [auditTrailEntries, setAuditTrailEntries] = useState<LedgerLogEntry[]>(initialEntries);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const toastTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToastMessage(message);
    setToastType(type);
    setToastOpen(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastOpen(false), 3000);
  }, []);

  useEffect(() => {
    const currentHostname = window.location.hostname;
    const websocketHost = currentHostname.includes(".") ? currentHostname : tenantSlug ? `${tenantSlug}.localhost` : "localhost";
    const echo = new Echo({
      broadcaster: "reverb",
      key: process.env.NEXT_PUBLIC_REVERB_APP_KEY || "logiflow_key",
      wsHost: websocketHost,
      wsPort: 8000,
      wssPort: 8000,
      forceTLS: false,
      enabledTransports: ["ws", "wss"],
      authorizer: (channel: any) => ({
        authorize: (socketId: string, callback: Function) => {
          authorizeChannel(channel.name, socketId, tenantSlug).then((data) => callback(false, data)).catch((error) => callback(true, error));
        },
      }),
    });

    const resolvedTenantId = String(tenantId);
    const channel = echo.private(`tenant.${resolvedTenantId}.ops`);
    channel.listen(REVERB_EVENT_NAME, (event: any) => {
      const payload: LiveDispatchEvent = event.dispatch ?? event;
      if (!payload.id) return;
      const referenceCode = payload.reference_code || payload.reference_number || "MANIFEST";
      const driverName = payload.driver_name || payload.driver?.name || "Assigned Driver";
      const auditEntry: LedgerLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: `Manifest ${referenceCode} advanced to ${payload.status || "in_transit"} (Driver: ${driverName})`,
        status: "success",
        created_at: new Date().toISOString(),
      };
      setAuditTrailEntries((previous) => [auditEntry, ...previous].slice(0, 15));
      showToast(auditEntry.message);
      setDispatches((previous) => {
        const index = previous.findIndex((dispatch) => String(dispatch.id) === String(payload.id));
        const existing = index === -1 ? undefined : previous[index];
        const nextDispatch = {
          ...(existing ?? {}),
          id: String(payload.id),
          tenant_id: String(payload.tenant_id ?? resolvedTenantId),
          status: payload.status ?? existing?.status ?? "in_transit",
          reference_code: referenceCode,
          driver_name: driverName,
          vehicle_identifier: payload.vehicle_identifier || existing?.vehicle_identifier || "FLEET-VAN",
          departed_at: payload.created_at || existing?.departed_at || new Date().toISOString(),
          warehouse: payload.warehouse || existing?.warehouse || { id: "wh_01", name: "Nike Warehouse Hub", code: "NKE-WH", timezone: "UTC", latitude: 0, longitude: 0 },
          stops: payload.stops || existing?.stops || [],
        } as Dispatch;
        const next = index === -1 ? [nextDispatch, ...previous] : previous.map((dispatch) => String(dispatch.id) === String(payload.id) ? nextDispatch : dispatch);
        const pendingStops = next.reduce((count, dispatch) => count + (dispatch.stops?.filter((stop) => String(stop.status).toLowerCase() === "pending").length || 0), 0);
        const liveDelays = next.filter((dispatch) => String(dispatch.status).toLowerCase() === "delayed").length;
        setMetrics((previousMetrics) => ({ ...previousMetrics, total_dispatches: next.length, pending_stops: pendingStops, live_delays: liveDelays }));
        return next;
      });
    });
    channel.error((error: unknown) => {
      console.error("[WebSocket] Subscription error", error);
      showToast("Realtime connection interrupted. Attempting to reconnect...", "error");
    });
    return () => {
      channel.stopListening(REVERB_EVENT_NAME);
      echo.disconnect();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [tenantSlug, tenantId, showToast]);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-12 lg:gap-6 lg:p-8">
        <section className="lg:col-span-12"><OperationalControlBoard tenantSlug={tenantSlug} /></section>
        <aside className="lg:col-span-3"><MetricsFeed initialMetrics={metrics} ledgerEntries={auditTrailEntries} onClearLedger={() => setAuditTrailEntries([])} /></aside>
        <section className="lg:col-span-6"><DispatchBoard initialDispatches={dispatches} tenantSlug={tenantSlug} usersRoster={usersRoster} /></section>
        <aside className="lg:col-span-3"><MonitoringSidebar usersRoster={usersRoster} /></aside>
      </div>
      {toastOpen && (
        <div role="alert" aria-live="assertive" className={`fixed bottom-6 right-6 z-[100] max-w-sm rounded-xl border shadow-2xl backdrop-blur-xl ${toastType === "success" ? "border-emerald-500/50 bg-emerald-950/90" : "border-rose-500/50 bg-rose-950/90"}`}>
          <div className="flex items-start gap-3 px-4 py-3"><div className="flex-1"><p className="text-sm font-medium text-zinc-100">{toastType === "success" ? "Dispatch Updated" : "Connection Alert"}</p><p className="mt-0.5 text-xs text-zinc-400">{toastMessage}</p></div><button onClick={() => setToastOpen(false)} className="text-zinc-500 hover:text-zinc-300" aria-label="Dismiss notification">X</button></div>
        </div>
      )}
    </>
  );
}
