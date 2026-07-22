"use client";

import { useState } from "react";
import { ChevronDown, MapPin, Package, Truck } from "lucide-react";
import type { Dispatch, Stop } from "@/types/logistics";
import { DispatchStatus, StopStatus } from "@/types/logistics";

interface DispatchBoardProps {
  initialDispatches: Dispatch[];
}

export function DispatchBoard({ initialDispatches }: DispatchBoardProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        initialDispatches
          .filter((d) => d.status === DispatchStatus.IN_TRANSIT || d.status === DispatchStatus.DELAYED)
          .map((d) => d.id)
      )
  );

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

      {initialDispatches.map((dispatch) => {
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
                  <span className="font-mono text-sm font-medium text-zinc-100">{dispatch.reference_code}</span>
                  <DispatchStatusBadge status={dispatch.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {dispatch.driver_name} · <span className="font-mono">{dispatch.vehicle_identifier}</span> ·{" "}
                  {dispatch.warehouse.name}
                </p>
              </div>

              <div className="hidden flex-none text-right sm:block">
                <p className="text-[11px] uppercase tracking-wide text-zinc-600">Departed</p>
                <p className="font-mono text-xs tabular-nums text-zinc-400">
                  {formatTime(dispatch.departed_at, dispatch.warehouse.timezone)}
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {dispatch.stops
                    .slice()
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((stop) => (
                      <StopCard key={stop.id} stop={stop} timeZone={dispatch.warehouse.timezone} />
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StopCard({ stop, timeZone }: { stop: Stop; timeZone: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-zinc-800 font-mono text-[10px] font-medium text-zinc-400">
            {stop.sequence}
          </span>
          <span className="font-mono text-xs font-medium text-zinc-300">{stop.order.order_number}</span>
        </div>
        <StopStatusBadge status={stop.status} />
      </div>

      <div className="mt-3 flex items-start gap-1.5 text-xs text-zinc-500">
        <MapPin className="mt-0.5 h-3 w-3 flex-none text-zinc-600" />
        <span>
          {stop.destination_address.line1}, {stop.destination_address.city} {stop.destination_address.state}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-zinc-500">
          <Package className="h-3 w-3 flex-none text-zinc-600" />
          <span className="truncate">{stop.order.customer_name}</span>
        </span>
        <span className="flex-none font-mono tabular-nums text-zinc-600">ETA {formatTime(stop.eta, timeZone)}</span>
      </div>
    </div>
  );
}

function DispatchStatusBadge({ status }: { status: DispatchStatus }) {
  switch (status) {
    case DispatchStatus.IN_TRANSIT:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          In Transit
        </span>
      );
    case DispatchStatus.DELAYED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
          Delayed
        </span>
      );
    case DispatchStatus.PENDING:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
          Pending
        </span>
      );
    case DispatchStatus.COMPLETED:
      return (
        <span className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
          ✓ Completed
        </span>
      );
    case DispatchStatus.CANCELLED:
      return (
        <span className="inline-flex items-center gap-1 rounded border border-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 line-through">
          Cancelled
        </span>
      );
    default:
      return null;
  }
}

function StopStatusBadge({ status }: { status: StopStatus }) {
  const styles: Record<StopStatus, string> = {
    [StopStatus.PENDING]: "bg-zinc-800 text-zinc-500",
    [StopStatus.EN_ROUTE]: "bg-sky-500/10 text-sky-400",
    [StopStatus.ARRIVED]: "bg-amber-500/10 text-amber-400",
    [StopStatus.COMPLETED]: "bg-emerald-500/10 text-emerald-400",
    [StopStatus.FAILED]: "bg-rose-500/10 text-rose-400",
  };

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function formatTime(iso: string | null, timeZone: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}