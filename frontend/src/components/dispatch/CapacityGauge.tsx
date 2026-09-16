"use client";

import { useEffect } from "react";

interface CapacityGaugeProps {
  currentWeightKg: number;
  maxCapacityKg: number;
  onOverCapacity?: () => void;
}

export function CapacityGauge({
  currentWeightKg,
  maxCapacityKg,
  onOverCapacity,
}: CapacityGaugeProps) {
  const weight = Number.isFinite(currentWeightKg) ? Math.max(0, currentWeightKg) : 0;
  const capacity = Number.isFinite(maxCapacityKg) ? Math.max(0, maxCapacityKg) : 0;
  const percentage = capacity > 0 ? (weight / capacity) * 100 : weight > 0 ? 100 : 0;
  const displayPercentage = Math.round(percentage);
  const progressWidth = Math.min(percentage, 100);
  const isOverCapacity = percentage > 100;
  const isNearLimit = percentage >= 85 && !isOverCapacity;
  const excessWeight = Math.max(0, weight - capacity);
  const barClass = isOverCapacity
    ? "bg-red-600"
    : isNearLimit
      ? "bg-amber-500"
      : "bg-emerald-500";

  useEffect(() => {
    if (isOverCapacity) {
      onOverCapacity?.();
    }
  }, [isOverCapacity, onOverCapacity]);

  return (
    <div
      aria-label={`Vehicle capacity: ${weight.toLocaleString()} kg of ${capacity.toLocaleString()} kg`}
      className="space-y-2"
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-zinc-300">
          {weight.toLocaleString()} kg / {capacity.toLocaleString()} kg
        </span>
        <span className={`font-mono font-semibold ${isOverCapacity ? "text-red-300" : isNearLimit ? "text-amber-300" : "text-emerald-300"}`}>
          {displayPercentage}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuenow={weight} aria-valuemin={0} aria-valuemax={capacity}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${barClass} ${isOverCapacity ? "animate-pulse" : ""}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
      {isOverCapacity && (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200">
          Exceeds vehicle capacity by {excessWeight.toLocaleString()} kg
        </div>
      )}
    </div>
  );
}
