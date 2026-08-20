// frontend/src/components/dispatch/DispatchOrderForm.tsx
"use client";

import { useCallback, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types mirroring the backend DispatchOrdersData / StopData DTOs
// ---------------------------------------------------------------------------

export interface StopFormData {
  /** Unique per-render id for React keys; not sent to the API. */
  key: string;
  orderId: string;
  destinationAddressLine1: string;
  destinationAddressCity: string;
  destinationAddressState: string;
  destinationAddressPostalCode: string;
  destinationAddressCountry: string;
}

export interface DispatchFormPayload {
  warehouse_id: number;
  reference_code: string;
  driver_name: string;
  vehicle_identifier: string;
  scheduled_at: string | null;
  stops: Array<{
    order_id: number;
    sequence: number;
    destination_address: {
      line1: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  }>;
}

export interface DispatchOrderFormProps {
  onSubmit: (payload: DispatchFormPayload) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let stopKeyCounter = 0;

function createEmptyStop(): StopFormData {
  stopKeyCounter += 1;
  return {
    key: `stop_${stopKeyCounter}`,
    orderId: "",
    destinationAddressLine1: "",
    destinationAddressCity: "",
    destinationAddressState: "",
    destinationAddressPostalCode: "",
    destinationAddressCountry: "US",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DispatchOrderForm({ onSubmit }: DispatchOrderFormProps) {
  const [warehouseId, setWarehouseId] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleIdentifier, setVehicleIdentifier] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [stops, setStops] = useState<StopFormData[]>([createEmptyStop()]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddStop = useCallback(() => {
    setStops((prev) => [...prev, createEmptyStop()]);
  }, []);

  const handleRemoveStop = useCallback((key: string) => {
    setStops((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const handleStopChange = useCallback(
    (key: string, field: keyof StopFormData, value: string) => {
      setStops((prev) =>
        prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)),
      );
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (stops.length === 0) {
        setError("A dispatch requires at least one stop");
        return;
      }

      setIsSubmitting(true);

      try {
        const payload: DispatchFormPayload = {
          warehouse_id: Number(warehouseId),
          reference_code: referenceCode,
          driver_name: driverName,
          vehicle_identifier: vehicleIdentifier,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          stops: stops.map((stop, index) => ({
            order_id: Number(stop.orderId),
            sequence: index + 1,
            destination_address: {
              line1: stop.destinationAddressLine1,
              city: stop.destinationAddressCity,
              state: stop.destinationAddressState,
              postal_code: stop.destinationAddressPostalCode,
              country: stop.destinationAddressCountry,
            },
          })),
        };

        await onSubmit(payload);
      } finally {
        setIsSubmitting(false);
      }
    },
    [warehouseId, referenceCode, driverName, vehicleIdentifier, scheduledAt, stops, onSubmit],
  );

  const inputClasses =
    "block w-full rounded-lg border border-zinc-800/60 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all duration-200 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 hover:border-zinc-700/80";
  const labelClasses = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500";
  const sectionTitleClasses = "text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400";
  const cardClasses = "bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-4 transition-all duration-150";

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Dispatch order form"
      noValidate
      className="space-y-10"
    >
      {/* ── Basic Dispatch Info ── */}
      <div>
        <h2 className={`${sectionTitleClasses} mb-5`}>Dispatch Details</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="warehouseId" className={labelClasses}>
              Warehouse ID
            </label>
            <input
              id="warehouseId"
              type="number"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
              className={inputClasses}
              placeholder="e.g. 42"
            />
          </div>
          <div>
            <label htmlFor="referenceCode" className={labelClasses}>
              Reference Code
            </label>
            <input
              id="referenceCode"
              type="text"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
              required
              className={inputClasses}
              placeholder="DSP-0001"
            />
          </div>
          <div>
            <label htmlFor="driverName" className={labelClasses}>
              Driver Name
            </label>
            <input
              id="driverName"
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className={inputClasses}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label htmlFor="vehicleIdentifier" className={labelClasses}>
              Vehicle Identifier
            </label>
            <input
              id="vehicleIdentifier"
              type="text"
              value={vehicleIdentifier}
              onChange={(e) => setVehicleIdentifier(e.target.value)}
              className={inputClasses}
              placeholder="TRK-8842"
            />
          </div>
          <div>
            <label htmlFor="scheduledAt" className={labelClasses}>
              Scheduled At
            </label>
            <input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={`${inputClasses} pr-3`}
            />
          </div>
        </div>
      </div>

      {/* ── Stops Section ── */}
      <fieldset className="space-y-5">
        <div className="flex items-center justify-between">
          <legend className={sectionTitleClasses}>Stops</legend>
          <span className={`rounded-full border border-zinc-800/60 bg-zinc-900/50 px-3 py-0.5 text-xs text-zinc-400 font-mono tabular-nums`}>
            {stops.length} stop{stops.length !== 1 ? "s" : ""}
          </span>
        </div>

        {stops.map((stop, index) => (
          <div
            key={stop.key}
            role="group"
            aria-label={`Stop ${index + 1}`}
            className={cardClasses}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-300">
                Stop {index + 1}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveStop(stop.key)}
                aria-label={`Remove stop ${index + 1}`}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-1">
                <label
                  htmlFor={`stop-${stop.key}-orderId`}
                  className={labelClasses}
                >
                  Order ID
                </label>
                <input
                  id={`stop-${stop.key}-orderId`}
                  type="number"
                  value={stop.orderId}
                  onChange={(e) => handleStopChange(stop.key, "orderId", e.target.value)}
                  required
                  className={inputClasses}
                  placeholder="1234"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label
                  htmlFor={`stop-${stop.key}-addressLine1`}
                  className={labelClasses}
                >
                  Address Line 1
                </label>
                <input
                  id={`stop-${stop.key}-addressLine1`}
                  type="text"
                  value={stop.destinationAddressLine1}
                  onChange={(e) =>
                    handleStopChange(stop.key, "destinationAddressLine1", e.target.value)
                  }
                  required
                  className={inputClasses}
                  placeholder="123 Industrial Pkwy"
                />
              </div>
              <div>
                <label
                  htmlFor={`stop-${stop.key}-city`}
                  className={labelClasses}
                >
                  City
                </label>
                <input
                  id={`stop-${stop.key}-city`}
                  type="text"
                  value={stop.destinationAddressCity}
                  onChange={(e) =>
                    handleStopChange(stop.key, "destinationAddressCity", e.target.value)
                  }
                  required
                  className={inputClasses}
                  placeholder="Fremont"
                />
              </div>
              <div>
                <label
                  htmlFor={`stop-${stop.key}-state`}
                  className={labelClasses}
                >
                  State
                </label>
                <input
                  id={`stop-${stop.key}-state`}
                  type="text"
                  value={stop.destinationAddressState}
                  onChange={(e) =>
                    handleStopChange(stop.key, "destinationAddressState", e.target.value)
                  }
                  required
                  className={inputClasses}
                  placeholder="CA"
                />
              </div>
              <div>
                <label
                  htmlFor={`stop-${stop.key}-postalCode`}
                  className={labelClasses}
                >
                  Postal Code
                </label>
                <input
                  id={`stop-${stop.key}-postalCode`}
                  type="text"
                  value={stop.destinationAddressPostalCode}
                  onChange={(e) =>
                    handleStopChange(stop.key, "destinationAddressPostalCode", e.target.value)
                  }
                  required
                  className={inputClasses}
                  placeholder="94538"
                />
              </div>
              <div>
                <label
                  htmlFor={`stop-${stop.key}-country`}
                  className={labelClasses}
                >
                  Country
                </label>
                <input
                  id={`stop-${stop.key}-country`}
                  type="text"
                  value={stop.destinationAddressCountry}
                  onChange={(e) =>
                    handleStopChange(stop.key, "destinationAddressCountry", e.target.value)
                  }
                  required
                  className={inputClasses}
                  placeholder="US"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddStop}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700/70 bg-zinc-900/20 py-3 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-300"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add Stop
        </button>
      </fieldset>

      {/* ── Manifest Payload Summary ── */}
      <div className={`${cardClasses} space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className={sectionTitleClasses}>Manifest Payload Summary</h3>
          <span className="rounded-full border border-zinc-800/60 bg-zinc-950/60 px-3 py-0.5 text-xs text-zinc-400 font-mono tabular-nums">
            {stops.length} stop{stops.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Reference</p>
            <p className="mt-1 font-mono text-sm font-semibold tracking-tight text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.15)] tabular-nums">
              {referenceCode || "—"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Vehicle</p>
            <p className="mt-1 font-mono text-sm font-semibold tracking-tight text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.15)] tabular-nums">
              {vehicleIdentifier || "—"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Driver</p>
            <p className="mt-1 font-mono text-sm font-semibold tracking-tight text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.15)] tabular-nums">
              {driverName || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Form Error ── */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 animate-in slide-in-from-top-2 duration-500"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Submit Button ── */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:from-emerald-300 hover:to-emerald-400 hover:shadow-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950" />
              Compiling route payload...
            </>
          ) : (
            <>
              Create Dispatch
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-300 group-hover:translate-x-0.5">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </span>
        {!isSubmitting && <div className="absolute inset-0 -translate-x-full skew-x-12 bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />}
      </button>
    </form>
  );
}