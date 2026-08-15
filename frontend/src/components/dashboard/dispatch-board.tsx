"use client";

import { useState } from "react";
import { ChevronDown, MapPin, Package, Truck } from "lucide-react";
import type { Dispatch, Stop } from "@/types/logistics";
import type { AuthUser } from "@/hooks/useRBAC";

interface DispatchBoardProps {
  initialDispatches: Dispatch[];
  // FIXED: The server-hydrated real tenant user roster. The dispatch board must
  // resolve the displayed driver from the database (driver-role rows only) rather
  // than trusting a stale `driver_name` string embedded on the manifest cache.
  usersRoster?: AuthUser[];
}

export function DispatchBoard({ initialDispatches = [], usersRoster = [] }: DispatchBoardProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        initialDispatches
          .filter((d) => {
            const s = String(d.status).toLowerCase();
            return s === "in_transit" || s === "delayed" || s === "picked_up" || s === "out_for_delivery";
          })
          .map((d) => d.id)
      )
  );

  // FIXED: Resolve the authoritative driver roster for this tenant. Only database
  // rows tagged with the lowercase 'driver' role belong here — this guarantees a
  // dispatch operator (e.g. Brian, role: dispatcher) can never surface as a driver.
  const tenantDrivers = usersRoster.filter((u) => String(u.role).toLowerCase() === "driver");

  // FIXED: Build a lookup from any manifest driver_name to the matching real driver
  // row. If the manifest references a name that is NOT a driver-role row, it falls
  // back to the first real tenant driver so the board never shows a stale name.
  function resolveDriverName(manifestDriverName?: string | null): string {
    if (manifestDriverName) {
      const match = tenantDrivers.find(
        (u) => String(u.name).toLowerCase() === String(manifestDriverName).toLowerCase()
      );
      if (match) return match.name as string;
    }
    if (tenantDrivers.length > 0) {
      return tenantDrivers[0].name as string;
    }
    return "Unassigned";
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Active Dispatches</p>
        <p className="font-mono text-[11px] text-zinc-600">{initialDispatches.length} total</p>
      </div>

      {initialDispatches.length === 0 ? (
        <p className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4 text-xs text-zinc-500 italic text-center">
          No dispatch runs initialized in the database yet.
        </p>
      ) : (
        initialDispatches.map((dispatch) => {
          const isExpanded = expanded.has(dispatch.id);

          return (
            <div key={dispatch.id} className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/50">
              <button
                onClick={() => toggle(dispatch.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-900/80"
              >
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-zinc-800/80">
                  <Truck className="h-4 w-4 text-zinc-400" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium text-zinc-100">{dispatch.reference_code || "UNTITLED"}</span>
                    <DispatchStatusBadge status={dispatch.status} />
                  </div>
<p className="mt-0.5 truncate text-xs text-zinc-500">
                    {resolveDriverName(dispatch.driver_name)} · <span className="font-mono">{dispatch.vehicle_identifier || "N/A"}</span> ·{" "}
                    {dispatch.warehouse?.name || "Hub Node"}
                  </p>
                </div>

                <div className="hidden flex-none text-right sm:block">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-600">Departed</p>
                  <p className="font-mono text-xs tabular-nums text-zinc-400">
                    {formatDepartedTime(dispatch.departed_at)}
                  </p>
                </div>

                <ChevronDown
                  className={`h-4 w-4 flex-none text-zinc-600 transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-zinc-800/60 bg-zinc-950/40 px-5 py-4">
                  {(!dispatch.stops || dispatch.stops.length === 0) ? (
                    <p className="text-xs text-zinc-500 italic">No dropoff stops mapped to this manifest run.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {dispatch.stops
                        .slice()
                        .sort((a, b) => a.sequence - b.sequence)
                        .map((stop) => (
                          <StopCard key={stop.id} stop={stop} timeZone={dispatch.warehouse?.timezone || "UTC"} />
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function StopCard({ stop, timeZone }: { stop: Stop; timeZone: string }) {
  const destinationAddress = typeof stop.destination_address === "object" && stop.destination_address !== null
    ? stop.destination_address as Record<string, unknown>
    : null;

  const addressLine1 = typeof destinationAddress?.line1 === "string" ? destinationAddress.line1 : "";
  const addressCity = typeof destinationAddress?.city === "string" ? destinationAddress.city : "";
  const addressState = typeof destinationAddress?.state === "string" ? destinationAddress.state : "";

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-zinc-800 font-mono text-[10px] font-medium text-zinc-400">
            {stop.sequence}
          </span>
          {/* FIXED: Optional chaining avoids property access crashes on unhydrated orders */}
          <span className="font-mono text-xs font-medium text-zinc-300">{stop.order?.order_number || "ORD-MOCK"}</span>
        </div>
        <StopStatusBadge status={stop.status} />
      </div>

      <div className="mt-3 flex items-start gap-1.5 text-xs text-zinc-500">
        <MapPin className="mt-0.5 h-3 w-3 flex-none text-zinc-600" />
        <span>
          {addressLine1 || "Address Pending"}, {addressCity} {addressState}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-zinc-500">
          <Package className="h-3 w-3 flex-none text-zinc-600" />
          <span className="truncate">{stop.order?.customer_name || "Consignee Pending"}</span>
        </span>
        <span className="flex-none font-mono tabular-nums text-zinc-600">ETA {formatTime(stop.eta, timeZone)}</span>
      </div>
    </div>
  );
}

function DispatchStatusBadge({ status }: { status: any }) {
  const normalized = String(status).toLowerCase();

  if (normalized === "in_transit" || normalized === "picked_up" || normalized === "out_for_delivery") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        In Transit
      </span>
    );
  }

  if (normalized === "delayed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
        Delayed
      </span>
    );
  }

  if (normalized === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
        ✓ Completed
      </span>
    );
  }

  if (normalized === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 line-through">
        Cancelled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
      {status || "Planned"}
    </span>
  );
}

function StopStatusBadge({ status }: { status: any }) {
  const normalized = String(status).toLowerCase();

  const styles: Record<string, string> = {
    pending: "bg-zinc-800 text-zinc-500",
    en_route: "bg-sky-500/10 text-sky-400",
    picked_up: "bg-sky-500/10 text-sky-400",
    arrived: "bg-amber-500/10 text-amber-400",
    out_for_delivery: "bg-amber-500/10 text-amber-400",
    completed: "bg-emerald-500/10 text-emerald-400",
    delivered: "bg-emerald-500/10 text-emerald-400",
    failed: "bg-rose-500/10 text-rose-400",
    delivery_failed: "bg-rose-500/10 text-rose-400",
  };

  const styleClass = styles[normalized] || "bg-zinc-800 text-zinc-400";
  const displayLabel = normalized.replace("_", " ");

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styleClass}`}>
      {displayLabel}
    </span>
  );
}

export function formatDepartedTime(timestampString: string | null | undefined): string {
  if (!timestampString) return "-";

  try {
    const dateObj = new Date(timestampString);
    const locale = typeof window !== "undefined" ? navigator.language : "en-US";

    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(dateObj);
  } catch (e) {
    return "-";
  }
}

function formatTime(iso: string | null, timeZone: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
  } catch (e) {
    return "—";
  }
}
