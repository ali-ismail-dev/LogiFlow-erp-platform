"use client";

import { useEffect, useState } from "react";
import type { Dispatch, LedgerLogEntry } from "@/types/logistics";
import { DispatchStatus } from "@/types/logistics";

interface MonitoringSidebarProps {
  dispatches: Dispatch[];
  initialLedgerEntries: LedgerLogEntry[];
}

const SIMULATED_LOG_MESSAGES = [
  "Reconciliation batch queued for warehouse sync",
  "Driver settlement export completed",
  "Manifest checksum verified",
  "Fuel surcharge ledger updated",
];

export function MonitoringSidebar({ dispatches, initialLedgerEntries }: MonitoringSidebarProps) {
  const [ledgerEntries, setLedgerEntries] = useState(initialLedgerEntries);
  const activeDrivers = dispatches.filter(
    (d) => d.status === DispatchStatus.IN_TRANSIT || d.status === DispatchStatus.DELAYED
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const roll = Math.random();
      const status: LedgerLogEntry["status"] = roll > 0.85 ? "failed" : roll > 0.5 ? "processing" : "success";
      const entry: LedgerLogEntry = {
        id: `ldg_${Date.now()}`,
        message: SIMULATED_LOG_MESSAGES[Math.floor(Math.random() * SIMULATED_LOG_MESSAGES.length)],
        status,
        created_at: new Date().toISOString(),
      };
      setLedgerEntries((prev) => [entry, ...prev].slice(0, 8));
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Active Drivers</p>
        <div className="flex flex-col gap-2">
          {activeDrivers.length === 0 && (
            <p className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3 text-xs text-zinc-600">
              No drivers currently active.
            </p>
          )}
          {activeDrivers.map((dispatch) => {
            const isDelayed = dispatch.status === DispatchStatus.DELAYED;
            return (
              <div
                key={dispatch.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">{dispatch.driver_name}</p>
                  <p className="font-mono text-[11px] text-zinc-500">{dispatch.vehicle_identifier}</p>
                </div>
                <span className="relative flex h-2 w-2 flex-none">
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                      isDelayed ? "bg-rose-400" : "bg-emerald-400"
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      isDelayed ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Ledger Generation Log
        </p>
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3">
          {ledgerEntries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2.5 text-xs">
              <LedgerStatusDot status={entry.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-zinc-300">{entry.message}</p>
                <p className="font-mono text-[10px] tabular-nums text-zinc-600">
                  {new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(
                    new Date(entry.created_at)
                  )}{" "}
                  UTC
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LedgerStatusDot({ status }: { status: LedgerLogEntry["status"] }) {
  if (status === "processing") return <span className="mt-1 h-1.5 w-1.5 flex-none animate-pulse rounded-full bg-sky-400" />;
  if (status === "failed") return <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-rose-500" />;
  return <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />;
}