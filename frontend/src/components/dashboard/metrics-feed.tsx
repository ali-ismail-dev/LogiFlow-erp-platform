"use client";

import { useEffect, useState } from "react";
import type { OperationalMetrics, LedgerLogEntry } from "@/types/logistics";
import { Trash2 } from "lucide-react";

interface MetricsFeedProps {
  initialMetrics: OperationalMetrics;
  ledgerEntries: LedgerLogEntry[];
  onClearLedger: () => void;
}

interface MetricDefinition {
  key: keyof OperationalMetrics;
  label: string;
}

const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "total_dispatches", label: "Total Dispatches" },
  { key: "pending_stops", label: "Pending Stops" },
  { key: "active_drivers", label: "Active Drivers" },
];

export function MetricsFeed({ 
  initialMetrics, 
  ledgerEntries = [], 
  onClearLedger 
}: MetricsFeedProps) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [justUpdated, setJustUpdated] = useState<keyof OperationalMetrics | null>(null);

  useEffect(() => {
    setMetrics(initialMetrics);
  }, [initialMetrics]);

  useEffect(() => {
    if (!justUpdated) return;
    const timeout = setTimeout(() => setJustUpdated(null), 900);
    return () => clearTimeout(timeout);
  }, [justUpdated]);

  return (
    <div className="flex flex-col gap-6">
      {/* Live Metrics Cards Section */}
      <div className="flex flex-col gap-3">
        <p className="px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Live Metrics
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {METRIC_DEFINITIONS.map((metric) => (
            <div
              key={metric.key}
              className={`rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-lg shadow-black/10 backdrop-blur-xl transition-colors duration-500 ${
                justUpdated === metric.key
                  ? "border-zinc-700 bg-zinc-900/80"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                  {metric.label}
                </span>
                {metric.key === "live_delays" && metrics.live_delays > 0 && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                )}
              </div>

              <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-white tabular-nums drop-shadow-[0_0_12px_rgba(34,211,238,0.2)]">
                {metrics[metric.key] ?? 0}
              </p>

              {/* Micro progress indicator meter */}
              <div className="mt-3 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-cyan-400 to-emerald-400 animate-pulse rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Relocated Full-Width Fleet Matrix Activity Log Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            Fleet Matrix Activity Log
          </p>
          {ledgerEntries.length > 0 && (
            <button
              type="button"
              onClick={onClearLedger}
              className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 transition-colors hover:text-rose-400 focus:outline-none"
              title="Clear all stored activity logs"
            >
              <Trash2 className="h-3 w-3" />
              Clear Logs
            </button>
          )}
        </div>

        {/* Bounded, wide container viewport to support endless real-time streaming */}
        <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-5 backdrop-blur-xl shadow-lg shadow-black/10 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {ledgerEntries.length === 0 ? (
            <p className="text-xs text-zinc-500 p-2">
              Awaiting incoming fleet telemetry data packets...
            </p>
          ) : (
            ledgerEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 text-xs border-b border-zinc-800/30 pb-2.5 last:border-0 last:pb-0"
              >
                <LedgerStatusDot status={entry.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-300 break-words leading-relaxed">
                    {entry.message}
                  </p>
                  <p className="font-mono text-[10px] tabular-nums text-zinc-600 mt-1">
                    {new Intl.DateTimeFormat("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    }).format(new Date(entry.created_at))}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LedgerStatusDot({ status }: { status: LedgerLogEntry["status"] }) {
  if (status === "processing")
    return (
      <span className="mt-1.5 h-1.5 w-1.5 flex-none animate-pulse rounded-full bg-sky-400" />
    );
  if (status === "failed")
    return (
      <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-rose-500" />
    );
  return (
    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
  );
}
