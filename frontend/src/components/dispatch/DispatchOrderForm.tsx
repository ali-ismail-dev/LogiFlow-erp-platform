"use client";

import { useCallback, useState } from "react";

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

  return (
    <form onSubmit={handleSubmit} aria-label="Dispatch order form" noValidate>
      {/* -------- Basic fields -------- */}
      <div className="space-y-4">
        <div>
          <label htmlFor="warehouseId">Warehouse ID</label>
          <input
            id="warehouseId"
            type="number"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="referenceCode">Reference Code</label>
          <input
            id="referenceCode"
            type="text"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="driverName">Driver Name</label>
          <input
            id="driverName"
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="vehicleIdentifier">Vehicle Identifier</label>
          <input
            id="vehicleIdentifier"
            type="text"
            value={vehicleIdentifier}
            onChange={(e) => setVehicleIdentifier(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="scheduledAt">Scheduled At</label>
          <input
            id="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
      </div>

      {/* -------- Stops section -------- */}
      <fieldset aria-label="Stops">
        <legend>Stops</legend>

        {stops.map((stop, index) => (
          <div key={stop.key} role="group" aria-label={`Stop ${index + 1}`}>
            <span>Stop {index + 1}</span>

            <div>
              <label htmlFor={`stop-${stop.key}-orderId`}>Order ID</label>
              <input
                id={`stop-${stop.key}-orderId`}
                type="number"
                value={stop.orderId}
                onChange={(e) => handleStopChange(stop.key, "orderId", e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor={`stop-${stop.key}-addressLine1`}>Address Line 1</label>
              <input
                id={`stop-${stop.key}-addressLine1`}
                type="text"
                value={stop.destinationAddressLine1}
                onChange={(e) => handleStopChange(stop.key, "destinationAddressLine1", e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor={`stop-${stop.key}-city`}>City</label>
              <input
                id={`stop-${stop.key}-city`}
                type="text"
                value={stop.destinationAddressCity}
                onChange={(e) => handleStopChange(stop.key, "destinationAddressCity", e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor={`stop-${stop.key}-state`}>State</label>
              <input
                id={`stop-${stop.key}-state`}
                type="text"
                value={stop.destinationAddressState}
                onChange={(e) => handleStopChange(stop.key, "destinationAddressState", e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor={`stop-${stop.key}-postalCode`}>Postal Code</label>
              <input
                id={`stop-${stop.key}-postalCode`}
                type="text"
                value={stop.destinationAddressPostalCode}
                onChange={(e) => handleStopChange(stop.key, "destinationAddressPostalCode", e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor={`stop-${stop.key}-country`}>Country</label>
              <input
                id={`stop-${stop.key}-country`}
                type="text"
                value={stop.destinationAddressCountry}
                onChange={(e) => handleStopChange(stop.key, "destinationAddressCountry", e.target.value)}
                required
              />
            </div>

            <button
              type="button"
              onClick={() => handleRemoveStop(stop.key)}
              aria-label={`Remove stop ${index + 1}`}
            >
              Remove Stop
            </button>
          </div>
        ))}

        <button type="button" onClick={handleAddStop}>
          Add Stop
        </button>
      </fieldset>

      {/* -------- Error / Submit -------- */}
      {error && (
        <div role="alert" aria-live="polite">
          {error}
        </div>
      )}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Create Dispatch"}
      </button>
    </form>
  );
}

