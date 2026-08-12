"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRBAC } from "@/hooks/useRBAC";
import { createApiClient } from "@/lib/api/apiClient";
import { buildTenantAwarePath } from "@/lib/tenant-routing";

interface OrderRecord {
  id: number | string;
  order_number?: string | null;
  customer_name?: string | null;
  status?: string | null;
  total_weight_kg?: number | string | null;
  warehouse_id?: number | string | null;
  created_at?: string | null;
}

interface DriverRecord {
  id: number | string;
  tenant_id?: number | string | null;
  user_id?: number | string | null;
  name?: string | null;
  email?: string | null;
  license_number?: string | null;
  phone_number?: string | null;
  status?: string | null;
}

interface VehicleRecord {
  id: number | string;
  tenant_id?: number | string | null;
  warehouse_id?: number | string | null;
  license_plate?: string | null;
  vehicle_type?: string | null;
  status?: string | null;
}

interface ApiEnvelope<T> {
  data: T | T[] | null;
  message?: string;
}

interface DispatchCreateResponse {
  id?: number | string;
  reference_code?: string;
  data?: {
    id?: number | string;
    reference_code?: string;
  };
}

function normalizeList<T>(payload: T | T[] | null | undefined): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload ? [payload] : [];
}

export default function NewDispatchPage() {
  const params = useParams();
  const tenant = (params?.tenant as string) || "unknown";
  const router = useRouter();
  const dashboardHref = buildTenantAwarePath("/dashboard", tenant);

  const { isSuperAdmin, isDispatcher, loading: rbacLoading } = useRBAC();
  const authorized = isSuperAdmin || isDispatcher;

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [driverId, setDriverId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const buildClient = useCallback(() => {
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;
    const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;
    return createApiClient({ baseUrl: backendBaseUrl });
  }, []);

  const fetchOrders = useCallback(async () => {
    const client = buildClient();
    const response = await client.get<ApiEnvelope<OrderRecord[]>>("/orders", {
      headers: {
        "X-Tenant-ID": tenant,
      },
    });

    if (response.status !== 200) {
      throw new Error("Unable to load pending order inventory.");
    }

    const payload = response.data?.data;
    const list = normalizeList<OrderRecord>(payload as OrderRecord | OrderRecord[] | null | undefined);

    setOrders(
      list.filter((order) => {
        const normalizedStatus = String(order?.status ?? "").trim().toLowerCase();
        return normalizedStatus === "pending" || normalizedStatus === "unassigned";
      }),
    );
  }, [buildClient, tenant]);

  const fetchDrivers = useCallback(async () => {
    const client = buildClient();
    const response = await client.get<ApiEnvelope<DriverRecord[]>>("/drivers", {
      headers: {
        "X-Tenant-ID": tenant,
      },
    });

    if (response.status !== 200) {
      throw new Error("Unable to load the driver roster.");
    }

    const payload = response.data?.data;
    const list = normalizeList<DriverRecord>(payload as DriverRecord | DriverRecord[] | null | undefined);
    setDrivers(list);
  }, [buildClient, tenant]);

  const fetchVehicles = useCallback(async () => {
    const client = buildClient();
    const response = await client.get<ApiEnvelope<VehicleRecord[]>>("/vehicles", {
      headers: {
        "X-Tenant-ID": tenant,
      },
    });

    if (response.status !== 200) {
      throw new Error("Unable to load the vehicle fleet inventory.");
    }

    const payload = response.data?.data;
    const list = normalizeList<VehicleRecord>(payload as VehicleRecord | VehicleRecord[] | null | undefined);
    setVehicles(list);
  }, [buildClient, tenant]);

  useEffect(() => {
    if (rbacLoading || !authorized) {
      return;
    }

    let isActive = true;

    const hydrateManifestData = async () => {
      setIsHydrating(true);
      setErrorMessage(null);

      try {
        await Promise.all([fetchOrders(), fetchDrivers(), fetchVehicles()]);
      } catch (error) {
        if (!isActive) {
          return;
        }
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to synchronize the manifest inventory.",
        );
      } finally {
        if (isActive) {
          setIsHydrating(false);
        }
      }
    };

    hydrateManifestData();

    return () => {
      isActive = false;
    };
  }, [authorized, fetchDrivers, fetchOrders, fetchVehicles, rbacLoading]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderIds.includes(Number(order.id))),
    [orders, selectedOrderIds],
  );

  const totalSelectedWeightKg = useMemo(
    () =>
      selectedOrders.reduce((sum, order) => {
        const value = Number(order.total_weight_kg ?? 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [selectedOrders],
  );

  const handleToggleOrder = useCallback((orderId: number) => {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!authorized) {
        setErrorMessage("You do not have permission to compile dispatch manifests.");
        return;
      }

      if (selectedOrderIds.length === 0) {
        setErrorMessage("Select at least one order line to build a route manifest.");
        return;
      }

      if (!driverId) {
        setErrorMessage("Choose an active driver for this route manifest.");
        return;
      }

      if (!vehicleId) {
        setErrorMessage("Choose a vehicle assignment before submission.");
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);
      setSubmitState("idle");

      try {
        const client = buildClient();
        const payload = {
          order_ids: selectedOrderIds,
          driver_id: Number(driverId),
          vehicle_id: Number(vehicleId),
        };

        const response = await client.post<DispatchCreateResponse>("/dispatches", payload, {
          headers: {
            "X-Tenant-ID": tenant,
          },
        });

        if (response.status < 200 || response.status >= 300) {
          throw new Error("The backend rejected this dispatch manifest.");
        }

        setSubmitState("success");
        setTimeout(() => {
          router.push(buildTenantAwarePath("/dashboard", tenant));
        }, 1600);
      } catch (error) {
        setErrorMessage(resolveErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [authorized, buildClient, driverId, router, selectedOrderIds, tenant, vehicleId],
  );

  if (rbacLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-200">
        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2.5 text-sm text-zinc-300 shadow-lg shadow-black/20">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
          Verifying dispatch permissions...
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-50">
        <div className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center shadow-2xl shadow-black/30">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/15 text-2xl text-rose-300">
            !
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300">Security exclusion</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Access restricted</h1>
          <p className="mt-3 text-sm text-rose-100/80">
            Manifest compilation is restricted to authorized dispatch personnel only.
          </p>
          <Link
            href={dashboardHref}
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-rose-400/30 bg-zinc-950/40 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:border-rose-400/50 hover:text-white"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href={dashboardHref} className="inline-flex items-center gap-2 text-xs text-zinc-400 transition hover:text-zinc-200">
              <span aria-hidden="true">←</span>
              Back to dashboard
            </Link>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              <span className="font-mono text-zinc-400">{tenant}</span>
              <span className="px-2 text-zinc-700">•</span>
              Dispatch manifest builder
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Create route manifest</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Manifest ready
          </div>
        </div>

        {submitState === "success" && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 shadow-lg shadow-emerald-900/10">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M5 10.5L8.2 13.7L15 6.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            Dispatch created successfully. Redirecting to the dashboard...
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/15 text-xs font-semibold text-rose-300">
              !
            </div>
            <span>{errorMessage}</span>
          </div>
        )}

        {isHydrating ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-10 text-center text-zinc-300 shadow-2xl shadow-black/20">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
            Loading orders, drivers, and vehicle inventory...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
              <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Available orders</p>
                    <h2 className="mt-1 text-xl font-semibold text-white">Unassigned queue</h2>
                  </div>
                  <span className="rounded-full border border-zinc-700 bg-zinc-950/80 px-2.5 py-1 text-xs font-medium text-zinc-400">
                    {orders.length} records
                  </span>
                </div>

                {orders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/40 p-8 text-center text-sm text-zinc-400">
                    No pending or unassigned orders are available for route compilation.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50">
                    <div className="max-h-[560px] overflow-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-zinc-900/95 text-zinc-400 backdrop-blur">
                          <tr>
                            <th className="px-4 py-3 font-medium">
                              <span className="sr-only">Select</span>
                            </th>
                            <th className="px-4 py-3 font-medium">Order</th>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium text-right">Weight</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((order) => {
                            const orderId = Number(order.id);
                            const isSelected = selectedOrderIds.includes(orderId);
                            const weightValue = Number(order.total_weight_kg ?? 0);

                            return (
                              <tr
                                key={String(order.id)}
                                className={`border-t border-zinc-800 transition ${
                                  isSelected ? "bg-emerald-500/5" : "bg-transparent hover:bg-zinc-900/80"
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <label className="inline-flex cursor-pointer items-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleOrder(orderId)}
                                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500"
                                    />
                                    <span className="sr-only">Select order {order.order_number ?? order.id}</span>
                                  </label>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-white">{order.order_number ?? `ORD-${order.id}`}</div>
                                </td>
                                <td className="px-4 py-3 text-zinc-300">{order.customer_name ?? "Unknown customer"}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-950/80 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-300">
                                    {String(order.status ?? "pending").toLowerCase()}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-zinc-200">
                                  {Number.isFinite(weightValue) ? `${weightValue.toFixed(1)} kg` : "0.0 kg"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <aside className="space-y-6">
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Manifest totals</p>

                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Total selected weight</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{totalSelectedWeightKg.toFixed(1)} kg</div>
                    </div>
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">Selected order count</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{selectedOrderIds.length}</div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Included orders</div>
                    {selectedOrders.length === 0 ? (
                      <p className="text-sm text-zinc-400">No orders selected yet.</p>
                    ) : (
                      <ul className="space-y-2 text-sm text-zinc-300">
                        {selectedOrders.map((order) => (
                          <li key={String(order.id)} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-2.5 py-2">
                            <span>{order.order_number ?? `ORD-${order.id}`}</span>
                            <span className="text-xs text-zinc-400">{Number(order.total_weight_kg ?? 0).toFixed(1)} kg</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Assignment</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Route detail</h2>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="driver-select" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Driver
                      </label>
                      <select
                        id="driver-select"
                        value={driverId}
                        onChange={(event) => setDriverId(event.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="">Select a driver</option>
                        {drivers.map((driver) => (
                          <option key={String(driver.id)} value={String(driver.id)}>
                            {driver.name || driver.email || `Driver #${driver.id}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="vehicle-select" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Vehicle
                      </label>
                      <select
                        id="vehicle-select"
                        value={vehicleId}
                        onChange={(event) => setVehicleId(event.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="">Select a vehicle</option>
                        {vehicles.map((vehicle) => (
                          <option key={String(vehicle.id)} value={String(vehicle.id)}>
                            {vehicle.license_plate || vehicle.vehicle_type || `Vehicle #${vehicle.id}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <input type="hidden" name="order_ids" value={JSON.stringify(selectedOrderIds)} />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="mt-2 flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                    >
                      {isSubmitting ? "Submitting manifest..." : "Compile manifest"}
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function resolveErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybeApiError = error as {
      response?: {
        data?: {
          message?: string;
          errors?: Record<string, string[]>;
        };
      };
    };

    const data = maybeApiError.response?.data;
    if (data?.errors) {
      const firstValue = Object.values(data.errors)[0];
      if (Array.isArray(firstValue) && firstValue.length > 0) {
        return firstValue[0];
      }
    }

    if (data?.message) {
      return data.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The dispatch manifest could not be created. Please review the route data and try again.";
}
