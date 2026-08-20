"use client";

// -----------------------------------------------------------------------------
// Fleet Operative Directory — Drivers Management
//
// Tenant-scoped management cockpit for auditing and provisioning driver
// profiles. All outbound traffic routes explicitly through the tenant-aware
// client factory, passing the dynamic tenant slug as the `X-Tenant-ID` header
// to the port-8000 backend proxy gateway (`http://<host>:8000/api/v1`).
//
// Access is fail-closed: only `super_admin` and `dispatcher` roles may view
// this perimeter. Unprivileged roles receive a security exception frame.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createApiClient } from "@/lib/api/apiClient";
import { buildTenantAwarePath } from "@/lib/tenant-routing";
import { useRBAC, type UserRole } from "@/hooks/useRBAC";

// -----------------------------------------------------------------------------
// Strict TypeScript contracts mirroring the backend resource serializers.
// -----------------------------------------------------------------------------

/** Mirrors `App\Http\Resources\DriverResource` exactly. */
interface DriverProfile {
  id: number | string;
  tenant_id: number | string;
  user_id: number | string;
  name: string | null;
  email: string | null;
  license_number: string;
  phone_number: string;
  status: "active" | "inactive" | "on_trip" | string;
}

/** Mirrors `App\Http\Resources\UserResource` exactly. */
interface RosterUser {
  id: number | string;
  name: string;
  email: string;
  tenant_id: number | string;
  role: UserRole;
}

/** Laravel-style paginated/envelope wrapper used by the API gateway. */
interface DriversEnvelope {
  data: DriverProfile[] | DriverProfile;
}

interface UsersEnvelope {
  data: RosterUser[] | RosterUser;
}

/** Status chip tone helper for the premium dark cockpit palette. */
function statusTone(status: string): string {
  const normalized = String(status).toLowerCase();
  if (normalized === "active") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
  }
  if (normalized === "on_trip") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-400";
  }
  return "border-zinc-700 bg-zinc-800 text-zinc-400";
}

// Toast notification overlay component
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
            {type === "success" ? "Success" : "Error"}
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

export default function FleetDriversPage() {
  const params = useParams();
  const tenant = (params?.tenant as string) || "unknown";
  const dashboardHref = buildTenantAwarePath("/dashboard", tenant);

  // ── RBAC Perimeter (fail-closed) ──
  const { isSuperAdmin, isDispatcher, loading: rbacLoading } = useRBAC();
  const authorizedManager = isSuperAdmin || isDispatcher;

  // ── Local data streams ──
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Provision modal state ──
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formUserId, setFormUserId] = useState<string>("");
  const [formLicense, setFormLicense] = useState<string>("");
  const [formPhone, setFormPhone] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ── Toast state ──
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    type: "success",
  });

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ open: true, message, type });
  }, []);

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

  // ── Remote drivers matrix stream ──
  const fetchDrivers = useCallback(async (): Promise<void> => {
    try {
      const client = buildClient();
      const response = await client.get<DriversEnvelope>("/drivers", {
        headers: { "X-Tenant-ID": tenant },
      });
      if (response.status === 200 && response.data?.data) {
        const payload = response.data.data;
        setDrivers(Array.isArray(payload) ? payload : [payload]);
        setCurrentPage(1);
      } else {
        throw new Error("Failed to parse fleet operative records.");
      }
    } catch (err: unknown) {
      console.error("[Fleet Matrix] Drivers fetch exception:", err);
      throw err;
    }
  }, [buildClient, tenant]);

  // ── Remote corporate roster stream ──
  const fetchRoster = useCallback(async (): Promise<void> => {
    try {
      const client = buildClient();
      const response = await client.get<UsersEnvelope>("/users", {
        headers: { "X-Tenant-ID": tenant },
      });
      if (response.status === 200 && response.data?.data) {
        const payload = response.data.data;
        setRoster(Array.isArray(payload) ? payload : [payload]);
      } else {
        throw new Error("Failed to parse corporate roster records.");
      }
    } catch (err: unknown) {
      console.error("[Fleet Matrix] Roster fetch exception:", err);
      throw err;
    }
  }, [buildClient, tenant]);

  // ── Concurrent state hydration pipeline ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchDrivers(), fetchRoster()]);
    } catch (err: unknown) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to synchronize fleet operative directory.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchDrivers, fetchRoster, showToast]);

  useEffect(() => {
    if (!rbacLoading && authorizedManager) {
      loadData();
    }
  }, [rbacLoading, authorizedManager, loadData]);

  // ── Isolate unassigned driver-role employees for the provision dropdown ──
  const driverCandidates = useMemo(() => {
    const assignedUserIds = new Set(drivers.map((d) => String(d.user_id)));
    return roster.filter(
      (u) =>
        String(u.role).toLowerCase() === "driver" &&
        !assignedUserIds.has(String(u.id)),
    );
  }, [roster, drivers]);

  // ── Pagination calculations ──
  const totalPages = Math.max(1, Math.ceil(drivers.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleDrivers = drivers.slice(startIndex, endIndex);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.min(Math.max(1, page), totalPages));
    },
    [totalPages],
  );

  // ── Modal form submission → POST /drivers ──
  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const client = buildClient();
      const response = await client.post<DriversEnvelope>(
        "/drivers",
        {
          user_id: Number(formUserId),
          license_number: formLicense.trim(),
          phone_number: formPhone.trim(),
        },
        { headers: { "X-Tenant-ID": tenant } },
      );

      if (response.status === 200 || response.status === 201) {
        // Clear form
        setFormUserId("");
        setFormLicense("");
        setFormPhone("");

        // Refresh both local data state arrays after successful provisioning.
        await loadData();

        // Show success toast
        showToast("Driver profile provisioned successfully.", "success");

        // Close modal
        setIsModalOpen(false);
      } else {
        throw new Error("The driver profile could not be provisioned.");
      }
    } catch (err: unknown) {
      console.error("[Fleet Matrix] Provision mutation crash:", err);
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to provision the operative profile.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (rbacLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm font-mono text-zinc-400">
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
        Synchronizing fleet operative matrix...
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300">Security Access Violation</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Unauthorized Perimeter Entry</h1>
          <p className="mt-3 text-sm text-rose-100/80">
            Fleet operative directory access is restricted to super administrators and dispatch personnel only.
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

  // ── Loading skeleton ──
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
              <span className="text-zinc-600">·</span> Fleet Operative Matrix
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
              Fleet Operative Directory
            </h1>
            <p className="text-xs text-zinc-500">
              Audit and assign driver profiles across the {tenant} workspace perimeter.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-md transition-all hover:from-emerald-300 hover:to-emerald-400 active:scale-95"
          >
            + Provision Driver Profile
          </button>
        </div>

        {/* ── Drivers matrix table ── */}
        <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-950/40 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                <th className="px-6 py-4">Operative Name</th>
                <th className="px-6 py-4">Corporate Email Identity</th>
                <th className="px-6 py-4">License Number</th>
                <th className="px-6 py-4">Contact Phone</th>
                <th className="px-6 py-4">Operational State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-sm">
              {visibleDrivers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center font-mono text-xs text-zinc-500">
                    No driver profiles provisioned for this tenant yet.
                  </td>
                </tr>
              ) : (
                visibleDrivers.map((driver) => (
                  <tr key={driver.id} className="transition-colors hover:bg-zinc-900/30">
                    <td className="px-6 py-4 font-medium text-zinc-200">{driver.name ?? "—"}</td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                      {driver.email ?? "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                      {driver.license_number}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                      {driver.phone_number}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider font-mono ${statusTone(
                          driver.status,
                        )}`}
                      >
                        {driver.status}
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
              {Math.min(endIndex, drivers.length)}
            </span>{" "}
            of{" "}
            <span className="font-mono text-zinc-300">{drivers.length}</span>{" "}
            operatives
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

        {/* ── Sliding Provision Driver Profile modal ── */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 duration-300 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl">
              <form onSubmit={handleProvisionSubmit} className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-50">
                    Provision Driver Profile
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Bind an unassigned driver employee to a new operative license profile.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                    Driver Employee
                  </label>
                  <select
                    required
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
                  >
                    <option value="" disabled>
                      {driverCandidates.length === 0
                        ? "No unassigned driver employees available"
                        : "Select an unassigned driver employee"}
                    </option>
                    {driverCandidates.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} — {user.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                    License Number
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={formLicense}
                    onChange={(e) => setFormLicense(e.target.value)}
                    placeholder="DL-4821-9930"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-emerald-500/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={30}
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+1 (555) 014-2291"
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
                    disabled={isSubmitting || driverCandidates.length === 0}
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
                        Provisioning fleet operative...
                      </>
                    ) : (
                      "Provision Profile"
                    )}
                  </button>
                </div>
              </form>
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