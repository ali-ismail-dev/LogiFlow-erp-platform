"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  MapPin,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { createApiClient } from "@/lib/api/apiClient";
import { formatWarehouseLocation } from "@/lib/address";
import { buildTenantAwarePath } from "@/lib/tenant-routing";
import { useRBAC } from "@/hooks/useRBAC";

interface WarehouseRecord {
  id?: number | string;
  tenant_id?: number | string;
  name: string;
  code: string;
  address?: string | Record<string, unknown> | null;
  city?: string | null;
  is_active?: boolean;
}

interface WarehousesEnvelope {
  data: WarehouseRecord[] | WarehouseRecord | null;
}

interface WarehouseDraft {
  name: string;
  code: string;
  address: string;
  city: string;
}

const emptyDraft: WarehouseDraft = {
  name: "",
  code: "",
  address: "",
  city: "",
};

function normalizeWarehouses(
  payload: WarehousesEnvelope["data"] | null | undefined,
): WarehouseRecord[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter(Boolean);
  return [payload].filter(Boolean);
}

interface ToastState {
  open: boolean;
  message: string;
  type: "success" | "error";
}

function ToastNotification({
  open,
  message,
  type,
  onClose,
}: {
  open: boolean;
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => {
      onClose();
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-6 right-6 z-[100] max-w-sm rounded-xl border shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out ${
        type === "success"
          ? "border-emerald-500/50 bg-emerald-950/90 shadow-emerald-500/20"
          : "border-rose-500/50 bg-rose-950/90 shadow-rose-500/20"
      }`}
      style={{
        animation: "toast-in 0.3s cubic-bezier(0.21, 1.02, 0.73, 1)",
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
            type === "success"
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-rose-500/20 text-rose-300"
          }`}
        >
          {type === "success" ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6l2.5 2.5L10 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 3l6 6M9 3L3 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-100">
            {type === "success" ? "Facility Updated" : "Facility Error"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-zinc-500 transition-colors hover:text-zinc-300"
          aria-label="Dismiss notification"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 3l8 8M11 3L3 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <style jsx>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(1rem) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

const PAGE_SIZE = 5;

export default function FacilityHubPage() {
  const params = useParams();
  const tenant = (params?.tenant as string) || "unknown";
  const dashboardHref = buildTenantAwarePath("/dashboard", tenant);

  const {
    isSuperAdmin,
    isDispatcher,
    isWarehouseManager,
    loading: rbacLoading,
  } = useRBAC();
  const authorizedManager = isSuperAdmin || isDispatcher || isWarehouseManager;

  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [draft, setDraft] = useState<WarehouseDraft>(emptyDraft);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);

  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    type: "success",
  });

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ open: true, message, type });
    },
    [],
  );

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  const buildClient = useCallback(() => {
    const currentHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const currentProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;
    return createApiClient({ baseUrl: backendBaseUrl });
  }, []);

  const fetchWarehouses = useCallback(async (): Promise<void> => {
    try {
      const client = buildClient();
      const response = await client.get<WarehousesEnvelope>("/warehouses", {
        headers: { "X-Tenant-ID": tenant },
      });

      if (response.status === 200 && response.data?.data !== undefined) {
        setWarehouses(normalizeWarehouses(response.data.data));
        setCurrentPage(1);
        return;
      }

      setWarehouses([]);
    } catch (err: unknown) {
      console.error("[Facility Hub] Warehouse fetch exception:", err);
      setWarehouses([]);
      throw err;
    }
  }, [buildClient, tenant]);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      await fetchWarehouses();
    } catch (err: unknown) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to synchronize the facility hub roster.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchWarehouses, showToast]);

  useEffect(() => {
    if (!rbacLoading && authorizedManager) {
      void loadData();
    }
  }, [rbacLoading, authorizedManager, loadData]);

  const handleFieldChange = (field: keyof WarehouseDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const cleanName = draft.name.trim();
    const cleanCode = draft.code.trim();
    const cleanAddress = draft.address.trim();
    const cleanCity = draft.city.trim();

    if (!cleanName || !cleanCode || !cleanAddress || !cleanCity) {
      showToast(
        "Please complete all facility hub registration fields.",
        "error",
      );
      return;
    }

    setIsSubmitting(true);
    setFormSuccess(false);

    try {
      const client = buildClient();
      const payload = {
        name: cleanName,
        code: cleanCode,
        address: cleanAddress,
        city: cleanCity,
        is_active: true,
      };

      const response = await client.post<WarehousesEnvelope>(
        "/warehouses",
        payload,
        {
          headers: { "X-Tenant-ID": tenant },
        },
      );

      if (response.status === 200 || response.status === 201) {
        const createdWarehouse = response.data?.data;
        const mappedWarehouse: WarehouseRecord =
          createdWarehouse && typeof createdWarehouse === "object"
            ? { ...payload, ...createdWarehouse }
            : { ...payload, id: Date.now(), tenant_id: tenant };

        setWarehouses((current) => [mappedWarehouse, ...current]);
        setDraft(emptyDraft);
        setFormSuccess(true);

        showToast(
          "Facility hub registered successfully. Roster updated.",
          "success",
        );

        setTimeout(() => {
          setIsModalOpen(false);
          setFormSuccess(false);
        }, 1500);
      } else {
        throw new Error("The facility hub could not be registered.");
      }
    } catch (err: unknown) {
      console.error("[Facility Hub] Register mutation crash:", err);
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to register the facility hub.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(warehouses.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleWarehouses = warehouses.slice(startIndex, endIndex);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.min(Math.max(1, page), totalPages));
    },
    [totalPages],
  );

  if (!rbacLoading && !authorizedManager) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-50">
        <div className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center shadow-2xl shadow-black/30">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/15 text-2xl text-rose-300">
            !
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300">
            Security exclusion
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Access restricted
          </h1>
          <p className="mt-3 text-sm text-rose-100/80">
            Facility hub management is restricted to authorized dispatch
            personnel only.
          </p>
          <Link
            href={buildTenantAwarePath("/driver/dashboard", tenant)}
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-rose-400/30 bg-zinc-950/40 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:border-rose-400/50 hover:text-white"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (rbacLoading || loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-zinc-100 lg:px-12">
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 pb-6">
            <div className="space-y-3">
              <div className="h-4 w-28 animate-pulse rounded-xl bg-zinc-900/40" />
              <div className="h-8 w-72 animate-pulse rounded-xl bg-zinc-900/40" />
              <div className="h-4 w-96 animate-pulse rounded-xl bg-zinc-900/40" />
            </div>
            <div className="h-10 w-40 animate-pulse rounded-xl bg-zinc-900/40" />
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20">
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 w-full animate-pulse rounded-xl bg-zinc-900/40"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-zinc-100 lg:px-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 30% 10%, rgba(34, 211, 238, 0.08) 0%, transparent 40%),
                            radial-gradient(circle at 80% 90%, rgba(245, 158, 11, 0.07) 0%, transparent 40%),
                            radial-gradient(circle, #27272a 1px, transparent 1px)`,
          backgroundSize: "100% 100%, 100% 100%, 20px 20px",
        }}
      />
      <div className="pointer-events-none absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 pb-6">
          <div>
            <Link
              href={dashboardHref}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard Cockpit
            </Link>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              <span className="font-mono text-xs normal-case tracking-normal text-zinc-400">
                {tenant}
              </span>{" "}
              <span className="text-zinc-600">·</span> Warehouse Network
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
              Facility Hub Management Portal
            </h1>
            <p className="text-xs text-zinc-500">
              Register and monitor fulfillment facilities across the {tenant}{" "}
              operational footprint.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl bg-gradient-to-b from-cyan-400 to-cyan-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-md transition-all hover:from-cyan-300 hover:to-cyan-400 active:scale-95"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" /> Register Facility Hub
            </span>
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-xl">
          <table className="w-full border-collapse text-left">
            <thead className="bg-zinc-900/60 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              <tr>
                <th className="px-5 py-4">Facility</th>
                <th className="px-5 py-4">Code</th>
                <th className="px-5 py-4">Location</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleWarehouses.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-sm text-zinc-500"
                  >
                    No fulfillment facilities have been registered yet.
                  </td>
                </tr>
              ) : (
                visibleWarehouses.map((facility) => (
                  <tr
                    key={facility.id ?? `${facility.name}-${facility.code}`}
                    className="border-t border-zinc-900/80 text-sm text-zinc-300 transition hover:bg-zinc-900/30"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-zinc-100">
                            {facility.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Warehouse ID #{facility.id ?? "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-200">
                        {facility.code || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                        <span>
                          {formatWarehouseLocation(
                            facility.address,
                            facility.city,
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          facility.is_active === false
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {facility.is_active === false
                          ? "Standby"
                          : "Operational"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination control bar */}
        <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between text-xs mt-4">
          <span className="text-zinc-500">
            Showing{" "}
            <span className="font-mono text-zinc-300">{startIndex + 1}</span> to{" "}
            <span className="font-mono text-zinc-300">
              {Math.min(endIndex, warehouses.length)}
            </span>{" "}
            of{" "}
            <span className="font-mono text-zinc-300">{warehouses.length}</span>{" "}
            facilities
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(safeCurrentPage - 1)}
              disabled={safeCurrentPage <= 1}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:text-zinc-300"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => goToPage(safeCurrentPage + 1)}
              disabled={safeCurrentPage >= totalPages}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:text-zinc-300"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950/95 p-6 shadow-2xl shadow-cyan-950/30">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
                  New facility
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Register Facility Hub
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setFormSuccess(false);
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formSuccess ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  Facility registered
                </h3>
                <p className="mt-2 text-sm text-emerald-100/80">
                  The new fulfillment hub has been added to the active warehouse
                  roster.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="facility-name"
                    className="mb-1.5 block text-xs font-medium text-zinc-300"
                  >
                    Facility Name
                  </label>
                  <input
                    id="facility-name"
                    value={draft.name}
                    onChange={(event) =>
                      handleFieldChange("name", event.target.value)
                    }
                    placeholder="Nike Central Logistics Hub"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="facility-code"
                    className="mb-1.5 block text-xs font-medium text-zinc-300"
                  >
                    Code Identification
                  </label>
                  <input
                    id="facility-code"
                    value={draft.code}
                    onChange={(event) =>
                      handleFieldChange("code", event.target.value)
                    }
                    placeholder="NKE-CENTRAL"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="facility-address"
                      className="mb-1.5 block text-xs font-medium text-zinc-300"
                    >
                      Street Address
                    </label>
                    <input
                      id="facility-address"
                      value={draft.address}
                      onChange={(event) =>
                        handleFieldChange("address", event.target.value)
                      }
                      placeholder="7400 Logistics Avenue"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="facility-city"
                      className="mb-1.5 block text-xs font-medium text-zinc-300"
                    >
                      City
                    </label>
                    <input
                      id="facility-city"
                      value={draft.city}
                      onChange={(event) =>
                        handleFieldChange("city", event.target.value)
                      }
                      placeholder="Dallas"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setFormSuccess(false);
                    }}
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-500/10 transition hover:from-cyan-300 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Registering facility hub...
                      </>
                    ) : (
                      "Register Facility"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ToastNotification
        open={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />
    </div>
  );
}