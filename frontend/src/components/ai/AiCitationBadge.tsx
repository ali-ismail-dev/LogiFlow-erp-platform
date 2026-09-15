"use client";

import { ExternalLink, Package, Radio, Route, Truck, Warehouse } from "lucide-react";
import type { AiCitation } from "@/services/aiCopilotApi";

interface AiCitationBadgeProps {
  citation: AiCitation;
  onCitationClick?: (citation: AiCitation) => void;
}

const citationStyles: Record<string, { icon: typeof Route; className: string; label: string }> = {
  dispatch: {
    icon: Route,
    className: "border-indigo-400/30 bg-indigo-500/10 text-indigo-200 hover:border-indigo-300/60 hover:bg-indigo-500/20",
    label: "Dispatch",
  },
  driver: {
    icon: Truck,
    className: "border-sky-400/30 bg-sky-500/10 text-sky-200 hover:border-sky-300/60 hover:bg-sky-500/20",
    label: "Driver",
  },
  order: {
    icon: Package,
    className: "border-amber-400/30 bg-amber-500/10 text-amber-200 hover:border-amber-300/60 hover:bg-amber-500/20",
    label: "Order",
  },
  stop: {
    icon: Warehouse,
    className: "border-rose-400/30 bg-rose-500/10 text-rose-200 hover:border-rose-300/60 hover:bg-rose-500/20",
    label: "Stop",
  },
};

export function AiCitationBadge({ citation, onCitationClick }: AiCitationBadgeProps) {
  const style = citationStyles[citation.type] ?? {
    icon: Radio,
    className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/60 hover:bg-emerald-500/20",
    label: citation.type,
  };
  const Icon = style.icon;

  return (
    <button
      type="button"
      onClick={() => onCitationClick?.(citation)}
      title={citation.reason}
      aria-label={`Open ${style.label} ${citation.id}: ${citation.reason}`}
      className={`group inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${style.className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{citation.id}</span>
      {onCitationClick && <ExternalLink className="h-3 w-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
    </button>
  );
}
