"use client";

import { BarChart3, Radio, Route, Siren } from "lucide-react";

interface AiPresetChipsProps {
  onSelectPrompt: (promptText: string) => void;
}

const presets = [
  {
    icon: Siren,
    label: "SLA risk scan",
    prompt: "Which deliveries are at risk of missing SLA today?",
    className: "border-rose-400/25 bg-rose-500/10 text-rose-100 hover:border-rose-300/60 hover:bg-rose-500/20",
  },
  {
    icon: Route,
    label: "Fleet workloads",
    prompt: "Compare active driver workloads across fleet",
    className: "border-sky-400/25 bg-sky-500/10 text-sky-100 hover:border-sky-300/60 hover:bg-sky-500/20",
  },
  {
    icon: BarChart3,
    label: "24h issues",
    prompt: "Summarize operational issues for the past 24h",
    className: "border-amber-400/25 bg-amber-500/10 text-amber-100 hover:border-amber-300/60 hover:bg-amber-500/20",
  },
  {
    icon: Radio,
    label: "Telemetry status",
    prompt: "Check vehicle telemetry and connection status",
    className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300/60 hover:bg-emerald-500/20",
  },
];

export function AiPresetChips({ onSelectPrompt }: AiPresetChipsProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Quick operational prompts">
      {presets.map(({ icon: Icon, label, prompt, className }) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelectPrompt(prompt)}
          title={prompt}
          className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold leading-4 transition-all hover:-translate-y-0.5 ${className}`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
