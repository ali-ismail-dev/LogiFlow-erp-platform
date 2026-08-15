"use client";

import { useEffect, useState, useCallback } from "react";
import type { LedgerLogEntry } from "@/types/logistics";
import type { AuthUser } from "@/hooks/useRBAC";
import { Trash2 } from "lucide-react";

interface MonitoringSidebarProps {
  initialEntries: LedgerLogEntry[];
  usersRoster?: AuthUser[];
}

export function MonitoringSidebar({ initialEntries, usersRoster = [] }: MonitoringSidebarProps) {
  const [ledgerEntries, setLedgerEntries] = useState<LedgerLogEntry[]>([]);

  const activeDrivers = usersRoster.filter((u) => String(u.role).toLowerCase() === "driver");

  // LOCALSTORAGE HYDRATION: Read persistent history data out of local disk storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLogs = localStorage.getItem("logiflow_fleet_activity_logs");
      if (savedLogs) {
        try {
          setLedgerEntries(JSON.parse(savedLogs));
          return;
        } catch (e) {
          // Fall back to empty array if data parses brokenly
        }
      }
    }
    setLedgerEntries(initialEntries);
  }, [initialEntries]);

  // LOCALSTORAGE WRITE SYNCHRONIZATION: Sync runtime local memory updates out to browser storage
  useEffect(() => {
    if (typeof window !== "undefined" && ledgerEntries.length > 0) {
      localStorage.setItem("logiflow_fleet_activity_logs", JSON.stringify(ledgerEntries));
    }
  }, [ledgerEntries]);

  // CLEAR TRIGGER ACTION OVERRIDE
  const handleClearAllLogs = useCallback(() => {
    setLedgerEntries([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("logiflow_fleet_activity_logs");
    }
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* Active Drivers Roster Panel */}
      <section>
        <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Active Drivers</p>
        <div className="flex flex-col gap-2">
          {activeDrivers.length === 0 && (
            <p className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3 text-xs text-zinc-600">
              No drivers currently active.
            </p>
          )}
          {activeDrivers.map((driver) => (
            <div
              key={driver.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3"
            >
              <div className="min-w-0 flex-1 pr-2">
                <p className="truncate text-sm font-medium text-zinc-200">{driver.name ?? "Unassigned Driver"}</p>
                <p className="font-mono text-[11px] text-zinc-500">{driver.email ?? "N/A"}</p>
              </div>
              <span className="relative flex h-2 w-2 flex-none">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Persistent & Scrollable Fleet Matrix Activity Log */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            Fleet Matrix Activity Log
          </p>
          {ledgerEntries.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllLogs}
              className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 transition-colors hover:text-rose-400"
              title="Clear all stored logs"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* FIXED: Added strict scroll overflow container rules */}
        <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1 rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {ledgerEntries.length === 0 ? (
            <p className="text-xs text-zinc-500/70 p-1">Awaiting incoming fleet telemetry data packets...</p>
          ) : (
            ledgerEntries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2.5 text-xs border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0">
                <LedgerStatusDot status={entry.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-300 break-words leading-relaxed">{entry.message}</p>
                  <p className="font-mono text-[10px] tabular-nums text-zinc-600 mt-1">
                    {new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).format(
                      new Date(entry.created_at)
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function LedgerStatusDot({ status }: { status: LedgerLogEntry["status"] }) {
  if (status === "processing") return <span className="mt-1.5 h-1.5 w-1.5 flex-none animate-pulse rounded-full bg-sky-400" />;
  if (status === "failed") return <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-rose-500" />;
  return <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />;
}
