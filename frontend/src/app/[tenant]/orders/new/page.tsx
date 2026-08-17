"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, MapPin, PackageCheck, ShieldCheck } from "lucide-react";
import { DashboardSecurityBoundary } from "@/components/dashboard/DashboardSecurityBoundary";
import { useRBAC } from "@/hooks/useRBAC";
import { createApiClient } from "@/lib/api/apiClient";
import { formatWarehouseLocation } from "@/lib/address";
import { buildTenantAwarePath } from "@/lib/tenant-routing";

interface WarehouseRecord {
  id?: number | string;
  tenant_id?: number | string;
  name?: string;
  code?: string;
  address?: string;
  city?: string;
  is_active?: boolean;
}

interface WarehousesEnvelope {
  data?: WarehouseRecord[] | WarehouseRecord | null;
  message?: string;
}

function normalizeWarehouses(payload: WarehousesEnvelope["data"] | null | undefined): WarehouseRecord[] {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.filter(Boolean);
  }

  return [payload].filter(Boolean);
}

export default function NewCargoOrderPage() {
  const params = useParams();
  const tenant = (params?.tenant as string) || "unknown";
  const router = useRouter();
  const dashboardHref = buildTenantAwarePath("/dashboard", tenant);

  const { isSuperAdmin, isDispatcher, loading: rbacLoading } = useRBAC();
  const authorized = isSuperAdmin || isDispatcher;

  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [totalWeightKg, setTotalWeightKg] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const buildClient = useCallback(() => {
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;
    const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;
    return createApiClient({ baseUrl: backendBaseUrl });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrateWarehouses = async () => {
      try {
        const client = buildClient();
        const response = await client.get<WarehousesEnvelope>("/warehouses", {
          headers: {
            "X-Tenant-ID": tenant,
          },
        });

        if (response.status === 200 || response.status === 201) {
          const warehouseList = normalizeWarehouses(response.data?.data ?? null);
          if (!isMounted) {
            return;
          }

          setWarehouses(warehouseList);
          if (warehouseList.length > 0 && !selectedWarehouseId) {
            setSelectedWarehouseId(String(warehouseList[0].id ?? ""));
          }
          if (warehouseList.length > 0 && selectedWarehouseId === "") {
            setSelectedWarehouseId(String(warehouseList[0].id ?? ""));
          }
        } else {
          setWarehouses([]);
        }
      } catch (error) {
        console.error("[Manual Order Form] Warehouse hydration failed:", error);
        if (isMounted) {
          setWarehouses([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingWarehouses(false);
        }
      }
    };

    void hydrateWarehouses();

    return () => {
      isMounted = false;
    };
  }, [buildClient, selectedWarehouseId, tenant]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authorized) {
      setSubmitError("You do not have permission to register an incoming cargo order.");
      return;
    }

    const trimmedOrderNumber = orderNumber.trim();
    const trimmedCustomerName = customerName.trim();
    const trimmedStreetAddress = streetAddress.trim();
    const trimmedCity = city.trim();
    const parsedWeight = Number(totalWeightKg);

    if (
      !trimmedOrderNumber ||
      !trimmedCustomerName ||
      !trimmedStreetAddress ||
      !trimmedCity ||
      !selectedWarehouseId ||
      !Number.isFinite(parsedWeight) ||
      parsedWeight <= 0
    ) {
      setSubmitError("Please complete all required order details and select a destination warehouse.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const client = buildClient();
      const payload = {
        warehouse_id: Number(selectedWarehouseId),
        order_number: trimmedOrderNumber,
        customer_name: trimmedCustomerName,
        total_weight_kg: Number(totalWeightKg),
        shipping_address: {
          street: trimmedStreetAddress,
          city: trimmedCity,
        },
        status: "pending",
      };

      const response = await client.post("/orders", payload, {
        headers: {
          "X-Tenant-ID": tenant,
        },
      });

      if (response.status !== 200 && response.status !== 201) {
        throw new Error("The order backend rejected this cargo registration request.");
      }

      setSuccessMessage("Cargo order registered successfully. Redirecting to unassigned queue...");
      setTimeout(() => {
        router.push(buildTenantAwarePath("/dispatches/new", tenant));
      }, 1500);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Cargo order registration failed. Please retry.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoadingState = rbacLoading || isLoadingWarehouses;

  if (!rbacLoading && !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-50">
        <div className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center shadow-2xl shadow-black/30">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/15 text-2xl text-rose-300">
            !
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300">
            Security exclusion
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Access restricted</h1>
          <p className="mt-3 text-sm text-rose-100/80">
            Manual cargo ingestion is restricted to dispatch personnel and warehouse administrators.
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

  if (isLoadingState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-200">
        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2.5 text-sm text-zinc-300 shadow-lg shadow-black/20">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
          Synchronizing warehouse roster...
        </div>
      </div>
    );
  }

  return (
    <DashboardSecurityBoundary tenant={tenant}>
      <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 md:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                href={dashboardHref}
                className="inline-flex items-center gap-2 text-xs text-zinc-400 transition hover:text-zinc-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to dashboard
              </Link>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                <span className="font-mono text-zinc-400">{tenant}</span>
                <span className="px-2 text-zinc-700">•</span>
                Cargo order intake
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Manual Cargo Order Ingestion
              </h1>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Live intake mode
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/20 ring-1 ring-zinc-900/70 backdrop-blur md:p-6">
              <div className="mb-6 flex items-center gap-3 border-b border-zinc-800 pb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    New inbound order
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-zinc-50">Cargo registration form</h2>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                      Order number
                    </span>
                    <input
                      value={orderNumber}
                      onChange={(event) => setOrderNumber(event.target.value)}
                      className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/60 px-3.5 py-3 text-sm text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="EL-10492"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                      Total weight (kg)
                    </span>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={totalWeightKg}
                      onChange={(event) => setTotalWeightKg(event.target.value)}
                      className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/60 px-3.5 py-3 text-sm text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="980"
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Customer name
                  </span>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/60 px-3.5 py-3 text-sm text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Northwind Logistics"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Active warehouse
                  </span>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <select
                      value={selectedWarehouseId}
                      onChange={(event) => setSelectedWarehouseId(event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-zinc-700 bg-zinc-950/60 px-10 py-3 text-sm text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {warehouses.length === 0 ? (
                        <option value="">No active warehouses available</option>
                      ) : (
                        warehouses.map((warehouse) => (
                          <option key={String(warehouse.id ?? `${warehouse.name}-${warehouse.code}`)} value={String(warehouse.id ?? "")}>
                            {warehouse.name || warehouse.code || "Warehouse"}
                            {warehouse.code ? ` · ${warehouse.code}` : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </label>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                    Shipping destination
                  </div>

                  <div className="space-y-4">
                    <label className="block space-y-2">
                      <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                        Street address
                      </span>
                      <input
                        value={streetAddress}
                        onChange={(event) => setStreetAddress(event.target.value)}
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/80 px-3.5 py-3 text-sm text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="245 Harbor Avenue"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                        City
                      </span>
                      <input
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/80 px-3.5 py-3 text-sm text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="Pittsburgh"
                      />
                    </label>
                  </div>
                </div>

                {submitError ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {submitError}
                  </div>
                ) : null}

                {successMessage ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    {successMessage}
                  </div>
                ) : null}

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Registering order..." : "Register cargo order"}
                  </button>
                </div>
              </form>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/20 ring-1 ring-zinc-900/70">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Warehouse roster
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-zinc-50">Live fulfillment nodes</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {warehouses.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                      No warehouses are active for this tenant right now.
                    </div>
                  ) : (
                    warehouses.map((warehouse) => (
                      <div
                        key={String(warehouse.id ?? `${warehouse.name}-${warehouse.code}`)}
                        className={`rounded-2xl border p-3 transition ${
                          String(warehouse.id ?? "") === selectedWarehouseId
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-zinc-800 bg-zinc-950/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-50">
                              {warehouse.name || warehouse.code || "Warehouse"}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {warehouse.code ? `Code · ${warehouse.code}` : "Uncoded facility"}
                            </p>
                          </div>
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-200">
                            active
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-zinc-400">
                          {formatWarehouseLocation(warehouse.address, warehouse.city)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 shadow-2xl shadow-black/20 ring-1 ring-zinc-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Intake checklist
                </p>
                <ul className="mt-4 space-y-3 text-sm text-zinc-300">
                  <li className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                      ✓
                    </span>
                    Confirm source warehouse availability
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                      ✓
                    </span>
                    Validate order number and customer identity
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                      ✓
                    </span>
                    Store delivery address before route assignment
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </DashboardSecurityBoundary>
  );
}
