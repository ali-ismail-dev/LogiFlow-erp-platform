"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface ResourceSelectOptionProps {
  label: string;
  sublabel?: string;
  status: "available" | "busy";
  activeDispatchCode?: string;
}

export function ResourceSelectOption({
  label,
  sublabel,
  status,
  activeDispatchCode,
}: ResourceSelectOptionProps) {
  const isBusy = status === "busy";

  return (
    <span className={`flex min-w-0 items-center justify-between gap-3 ${isBusy ? "opacity-65" : ""}`}>
      <span className="min-w-0">
        <span className="block truncate font-medium">{label}</span>
        {sublabel && <span className="block truncate text-xs text-zinc-500">{sublabel}</span>}
      </span>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isBusy ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
        {isBusy ? <AlertTriangle size={11} aria-hidden="true" /> : <CheckCircle2 size={11} aria-hidden="true" />}
        {isBusy ? `Busy${activeDispatchCode ? `: ${activeDispatchCode}` : ""}` : "Available"}
      </span>
    </span>
  );
}
