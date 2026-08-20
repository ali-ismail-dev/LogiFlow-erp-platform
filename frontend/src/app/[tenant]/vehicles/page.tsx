"use client";

// -----------------------------------------------------------------------------
// Fleet Asset Directory — Vehicles Management
//
// Tenant-scoped management cockpit for auditing and registering fleet equipment
// assets. All outbound traffic routes explicitly through the tenant-aware client
// factory, passing the dynamic tenant slug as the `X-Tenant-ID` header to the
// port-8000 backend proxy gateway (`http://<host>:8000/api/v1`).
//
// Access is fail-closed: only `super_admin` and `dispatcher` roles may view this
// perimeter. Unprivileged roles receive a security exception frame routing them
// back to the cockpit dashboard.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createApiClient } from "@/lib/api/apiClient";
import { buildTenantAwarePath } from "@/lib/tenant-routing";
import { useRBAC } from "@/hooks/useRBAC";

// -----------------------------------------------------------------------------
// Strict TypeScript contracts mirroring the backend resource serializer.
// Mirrors `App\Http\Resources\VehicleResource` exactly.
// -----------------------------------------------------------------------------

/** Mirrors `App\Http\Resources\VehicleResource` exactly. */
interface VehicleAsset {
  id: number | string;
  tenant_id: number | string;
  name: string;
  license_plate: string;
  max_weight_capacity_kg: number | string;
  is_active: boolean;
}

/** Laravel-style envelope wrapper used by the API gateway. */
interface VehiclesEnvelope {
  data: VehicleAsset[] | VehicleAsset;
}

/** Status chip tone helper for the premium dark cockpit palette. */
function statusTone(isActive: boolean): string {
  if (isActive) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
  }
  return "border-amber-500/20 bg-amber-500/10 text-amber-400";
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
            {type === "success" ? "Fleet Updated" : "Fleet Error"}
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

export default function FleetVehiclesPage() {
  const params = useParams();
  const tenant = (params?.tenant as string) || "unknown";
  const dashboardHref = buildTenantAwarePath("/dashboard", tenant);

  // ── RBAC Perimeter (fail-closed) ──
  const { isSuperAdmin, isDispatcher, loading: rbacLoading } = useRBAC();
  const authorizedManager = isSuperAdmin || isDispatcher;

  // ── Local data stream ──
  const [vehicles, setVehicles] = useState<VehicleAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Registration modal state ──
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formName, setFormName] = useState<string>("");
  const [formLicensePlate, setFormLicensePlate] = useState<string>("");
  const [formMaxWeight, setFormMaxWeight] = useState<string>("");
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

  // ── Tenant-aware gateway base URL (port-8000 proxy) ──
  const buildClient = useCallback(() => {
    const currentHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const currentProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;
    return createApiClient({ baseUrl: backendBaseUrl });
  }, []);

  // ── Remote fleet assets matrix stream ──
  const fetchVehicles = useCallback(async (): Promise<void> => {
    try {
      const client = buildClient();
      const response = await client.get<VehiclesEnvelope>("/vehicles", {
        headers: { "X-Tenant-ID": tenant },
      });
      if (response.status === 200 && response.data?.data) {
        const payload = response.data.data;
        setVehicles(Array.isArray(payload) ? payload : [payload]);
        setCurrentPage(1);
      } else {
        throw new Error("Failed to parse fleet asset records.");
      }
    } catch (err: unknown) {
      console.error("[Fleet Matrix] Vehicles fetch exception:", err);
      throw err;
    }
  }, [buildClient, tenant]);

  // ── State hydration pipeline ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchVehicles();
    } catch (err: unknown) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to synchronize fleet asset directory.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchVehicles, showToast]);

  useEffect(() => {
    if (!rbacLoading && authorizedManager) {
      loadData();
    }
  }, [rbacLoading, authorizedManager, loadData]);

  const totalPages = Math.max(1, Math.ceil(vehicles.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleVehicles = vehicles.slice(startIndex, endIndex);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.min(Math.max(1, page), totalPages));
    },
    [totalPages],
  );

  if (rbacLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm font-mono text-zinc-400">
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
        Synchronizing fleet asset matrix...
      </div>
    );
  }

  if (!authorizedManager) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-50">
        <div className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center shadow-2xl shadow-black/30">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/15 text-2xl text-rose-300">
            !
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300">
            Security Access Violation
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Unauthorized Perimeter Entry
          </h1>
          <p className="mt-3 text-sm text-rose-100/80">
            Fleet equipment directory access is restricted to super
            administrators and dispatch personnel only.
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

  // ── Modal form submission → POST /vehicles ──
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setFormSuccess(false);

    try {
      const client = buildClient();
      const response = await client.post<VehiclesEnvelope>(
        "/vehicles",
        {
          name: formName.trim(),
          license_plate: formLicensePlate.trim(),
          max_weight_capacity_kg: Number(formMaxWeight),
          is_active: true,
        },
        { headers: { "X-Tenant-ID": tenant } },
      );

      if (response.status === 200 || response.status === 201) {
        setFormSuccess(true);
        setFormName("");
        setFormLicensePlate("");
        setFormMaxWeight("");

        // Refresh the local data state array after successful registration.
        await loadData();

        showToast("Fleet vehicle registered successfully.", "success");

        // Animated checkmark confirmation badge, then smooth auto-dismiss.
        setTimeout(() => {
          setIsModalOpen(false);
          setFormSuccess(false);
        }, 1500);
      } else {
        throw new Error("The fleet vehicle could not be registered.");
      }
    } catch (err: unknown) {
      console.error("[Fleet Matrix] Register mutation crash:", err);
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to register the fleet asset.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading splash with skeleton ──
  if (loading) {
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
                  className="h-10 w-full animate-pulse rounded-xl bg-zinc-900/40"
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
      {/* ── Ambient background texture & glow ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 30% 10%, rgba(16, 185, 129, 0.08) 0%, transparent 40%),
                            radial-gradient(circle at 80% 90%, rgba(245, 158, 11, 0.05) 0%, transparent 40%),
                            radial-gradient(circle, #27272a 1px, transparent 1px)`,
          backgroundSize: "100% 100%, 100% 100%, 20px 20px",
        }}
      />
      <div className="pointer-events-none absolute -top-20 left-1/3 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* ── Header bar ── */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 pb-6">
          <div>
            <Link
              href={dashboardHref}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              ← Dashboard Cockpit
            </Link>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              <span className="font-mono text-xs normal-case tracking-normal text-zinc-400">
                {tenant}
              </span>{" "}
              <span className="text-zinc-600">·</span> Fleet Asset Matrix
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
              Fleet Equipment Directory
            </h1>
            <p className="text-xs text-zinc-500">
              Audit and register fleet equipment assets across the {tenant}{" "}
              workspace perimeter.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-md transition-all hover:from-emerald-300 hover:to-emerald-400 active:scale-95"
          >
            + Register Fleet Vehicle
          </button>
        </div>

        {/* ── Vehicles matrix table ── */}
        <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-950/40 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                <th className="px-6 py-4">Asset Designation</th>
                <th className="px-6 py-4">License Plate</th>
                <th className="px-6 py-4">Max Weight Capacity (kg)</th>
                <th className="px-6 py-4">Operational State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-sm">
              {visibleVehicles.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center font-mono text-xs text-zinc-500"
                  >
                    No fleet vehicles registered for this tenant yet.
                  </td>
                </tr>
              ) : (
                visibleVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className="transition-colors hover:bg-zinc-900/30"
                  >
                    <td className="px-6 py-4 font-medium text-zinc-200">
                      {vehicle.name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                      {vehicle.license_plate}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                      {Number(vehicle.max_weight_capacity_kg).toLocaleString(
                        "en-US",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider font-mono ${statusTone(
                          Boolean(vehicle.is_active),
                        )}`}
                      >
                        {vehicle.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination control bar ── */}
        <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between text-xs mt-4">
          <span className="text-zinc-500">
            Showing{" "}
            <span className="font-mono text-zinc-300">{startIndex + 1}</span> to{" "}
            <span className="font-mono text-zinc-300">
              {Math.min(endIndex, vehicles.length)}
            </span>{" "}
            of{" "}
            <span className="font-mono text-zinc-300">{vehicles.length}</span>{" "}
            assets
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

        {/* ── Sliding Register Fleet Vehicle modal ── */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 duration-300 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl">
              {formSuccess ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="animate-bounce text-3xl text-emerald-400">
                    ✓
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-emerald-400">
                    Fleet Vehicle Registered Successfully
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Refreshing fleet asset matrix records...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-50">
                      Register Fleet Vehicle
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Provision a new equipment asset under the {tenant}{" "}
                      workspace perimeter.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                      Vehicle Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ford Transit Custom"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-emerald-500/60 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                      License Plate
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={50}
                      value={formLicensePlate}
                      onChange={(e) => setFormLicensePlate(e.target.value)}
                      placeholder="LV-482-A"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-emerald-500/60 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                      Max Weight Capacity (kg)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="0.01"
                      value={formMaxWeight}
                      onChange={(e) => setFormMaxWeight(e.target.value)}
                      placeholder="1500"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-emerald-500/60 focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      disabled={isSubmitting}
                      className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-xs font-semibold transition-colors hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                          Provisioning fleet equipment...
                        </>
                      ) : (
                        "Register Vehicle"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      <ToastNotification
        open={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />
    </div>
  );
}