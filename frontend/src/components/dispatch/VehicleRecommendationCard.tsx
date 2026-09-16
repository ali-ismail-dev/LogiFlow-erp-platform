"use client";

export interface VehicleRecommendation {
  vehicle_identifier: string;
  vehicle_name?: string | null;
  max_weight_capacity_kg: number;
  utilization_percentage: number;
  is_best_match: boolean;
}

interface VehicleRecommendationCardProps {
  recommendations: VehicleRecommendation[];
  selectedVehicleIdentifier?: string;
  onApplyVehicle: (vehicleIdentifier: string) => void;
  isLoading?: boolean;
}

export function VehicleRecommendationCard({
  recommendations,
  selectedVehicleIdentifier,
  onApplyVehicle,
  isLoading = false,
}: VehicleRecommendationCardProps) {
  if (!isLoading && recommendations.length === 0) {
    return null;
  }

  return (
    <section aria-label="Smart vehicle recommendation" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Smart Recommendation</p>
          <p className="mt-1 text-sm text-zinc-300">Available vehicles ranked by payload efficiency.</p>
        </div>
        {isLoading && <span className="text-xs text-emerald-300">Calculating...</span>}
      </div>

      <div className="space-y-2">
        {recommendations.map((vehicle) => {
          const isSelected = selectedVehicleIdentifier === vehicle.vehicle_identifier;
          const isOptimal = vehicle.is_best_match;

          return (
            <div key={vehicle.vehicle_identifier} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-700/60 bg-zinc-950/50 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{vehicle.vehicle_identifier}</p>
                <p className="text-xs text-zinc-500">{vehicle.vehicle_name ?? "Fleet vehicle"} · {vehicle.max_weight_capacity_kg.toLocaleString()} kg capacity</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isOptimal ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-800 text-zinc-300"}`}>
                  {Math.round(vehicle.utilization_percentage)}% {isOptimal ? "Optimal Load" : "Utilization"}
                </span>
                <button
                  type="button"
                  onClick={() => onApplyVehicle(vehicle.vehicle_identifier)}
                  disabled={isSelected}
                  className="rounded-lg border border-emerald-400/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/10 disabled:cursor-default disabled:opacity-50"
                >
                  {isSelected ? "Applied" : "Apply Vehicle"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}