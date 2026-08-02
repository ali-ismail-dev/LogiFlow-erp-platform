"use client";

import { useEffect, useState } from "react";
import type { OperationalMetrics } from "@/types/logistics";

interface MetricsFeedProps {
  initialMetrics: OperationalMetrics;
}

interface MetricDefinition {
  key: keyof OperationalMetrics;
  label: string;
  accent: string;
}

const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "total_dispatches", label: "Total Dispatches", accent: "text-zinc-100" },
  { key: "pending_stops", label: "Pending Stops", accent: "text-amber-400" },
  { key: "live_delays", label: "Live Delays", accent: "text-rose-400" },
  { key: "active_drivers", label: "Active Drivers", accent: "text-sky-400" },
];

export function MetricsFeed({ initialMetrics }: MetricsFeedProps) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [justUpdated, setJustUpdated] = useState<keyof OperationalMetrics | null>(null);

  // Sync state cleanly whenever server props or parents update via socket telemetry
  useEffect(() => {
    setMetrics(initialMetrics);
  }, [initialMetrics]);

  useEffect(() => {
    if (!justUpdated) return;
    const timeout = setTimeout(() => setJustUpdated(null), 900);
    return () => clearTimeout(timeout);
  }, [justUpdated]);

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Live Metrics</p>

      {METRIC_DEFINITIONS.map((metric) => (
        <div
          key={metric.key}
          className={`rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4 transition-colors duration-500 ${
            justUpdated === metric.key ? "border-zinc-700 bg-zinc-900/80" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">{metric.label}</span>
            {metric.key === "live_delays" && metrics.live_delays > 0 && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            )}
          </div>
          <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${metric.accent}`}>
            {metrics[metric.key]}
          </p>
        </div>
      ))}
    </div>
  );
}
