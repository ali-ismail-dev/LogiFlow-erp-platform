"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Truck, Users } from "lucide-react";
import { createApiClient } from "@/lib/api/apiClient";

interface DriverOption {
  id: number | string;
  name?: string | null;
  email?: string | null;
}

interface VehicleOption {
  id: number | string;
  license_plate?: string | null;
  vehicle_type?: string | null;
}

interface AssignFleetModalProps {
  isOpen: boolean;
  tenantSlug: string;
  dispatchId: string | number;
  onClose: () => void;
  onAssigned: (payload: { id: string | number; driver_name: string | null; vehicle_identifier: string | null }) => void;
}

interface ApiEnvelope<T> {
  data: T | T[] | null;
}

function normalizeList<T>(payload: T | T[] | null | undefined): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload ? [payload] : [];
}

export function AssignFleetModal({
  isOpen,
  tenantSlug,
  dispatchId,
  onClose,
  onAssigned,
}: AssignFleetModalProps) {
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const buildClient = useCallback(() => {
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;
    const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;
    return createApiClient({ baseUrl: backendBaseUrl });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isActive = true;

    async function hydrateRoster() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const client = buildClient();
        const [driversResponse, vehiclesResponse] = await Promise.all([
          client.get<ApiEnvelope<DriverOption[]>>("/drivers", {
            headers: { "X-Tenant-ID": tenantSlug },
          }),
          client.get<ApiEnvelope<VehicleOption[]>>("/vehicles", {
            headers: { "X-Tenant-ID": tenantSlug },
          }),
        ]);

        if (driversResponse.status !== 200 || vehiclesResponse.status !== 200) {
          throw new Error("Unable to load fleet assignment options.");
        }

        const nextDrivers = normalizeList<DriverOption>(
          driversResponse.data?.data as DriverOption | DriverOption[] | null | undefined,
        );
        const nextVehicles = normalizeList<VehicleOption>(
          vehiclesResponse.data?.data as VehicleOption | VehicleOption[] | null | undefined,
        );

        if (isActive) {
          setDrivers(nextDrivers);
          setVehicles(nextVehicles);
          setSelectedDriverId(nextDrivers[0]?.id ? String(nextDrivers[0].id) : "");
          setSelectedVehicleId(nextVehicles[0]?.id ? String(nextVehicles[0].id) : "");
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "The fleet roster could not be loaded right now.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    hydrateRoster();

    return () => {
      isActive = false;
    };
  }, [buildClient, isOpen, tenantSlug]);

  const disabledSubmit = useMemo(
    () => isSubmitting || !selectedDriverId || !selectedVehicleId,
    [isSubmitting, selectedDriverId, selectedVehicleId],
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedDriverId || !selectedVehicleId) {
      setErrorMessage("Select both a driver and a vehicle before confirming the assignment.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const client = buildClient();
      const response = await client.put<{ data?: { id?: string | number; driver_name?: string | null; vehicle_identifier?: string | null } }>(
        `/dispatches/${dispatchId}/assign`,
        {
          driver_id: Number(selectedDriverId),
          vehicle_id: Number(selectedVehicleId),
        },
        {
          headers: { "X-Tenant-ID": tenantSlug },
        },
      );

      if (response.status < 200 || response.status >= 300) {
        throw new Error("The backend rejected the fleet assignment.");
      }

      const updated = response.data?.data ?? null;
      const nextDriverName = updated?.driver_name ?? null;
      const nextVehicleIdentifier = updated?.vehicle_identifier ?? null;

      onAssigned({
        id: updated?.id ?? dispatchId,
        driver_name: nextDriverName,
        vehicle_identifier: nextVehicleIdentifier,
      });

      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The fleet assignment could not be processed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [buildClient, dispatchId, onAssigned, onClose, selectedDriverId, selectedVehicleId, tenantSlug]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Fleet assignment</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Assign active route assets</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-700 bg-zinc-900 p-2 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
            aria-label="Close fleet assignment modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="mt-6 flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-8 text-sm text-zinc-300">
            <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
            Loading drivers and vehicles...
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="assign-driver" className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                <Users className="h-3.5 w-3.5" />
                Driver
              </label>
              <select
                id="assign-driver"
                value={selectedDriverId}
                onChange={(event) => setSelectedDriverId(event.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Select an available driver</option>
                {drivers.map((driver) => (
                  <option key={String(driver.id)} value={String(driver.id)}>
                    {driver.name || driver.email || `Driver #${driver.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="assign-vehicle" className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                <Truck className="h-3.5 w-3.5" />
                Vehicle
              </label>
              <select
                id="assign-vehicle"
                value={selectedVehicleId}
                onChange={(event) => setSelectedVehicleId(event.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Select an available vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={String(vehicle.id)} value={String(vehicle.id)}>
                    {vehicle.license_plate || vehicle.vehicle_type || `Vehicle #${vehicle.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={disabledSubmit}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
              >
                {isSubmitting ? "Assigning fleet..." : "Confirm assignment"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
