"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createApiClient } from "@/lib/api/apiClient";
import { buildTenantAwarePath } from "@/lib/tenant-routing";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import type { AuthUser } from "@/hooks/useRBAC";
import type { Dispatch as DispatchEntity } from "@/types/logistics";

type DispatchStatus =
  | "planned"
  | "in_transit"
  | "arrived"
  | "completed"
  | "cancelled";

interface DispatchRow extends Omit<DispatchEntity, "status"> {
  status: DispatchStatus;
}

interface AuthMeEnvelope {
  data: AuthUser;
}

interface DispatchesEnvelope {
  data: DispatchEntity[];
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
            {type === "success" ? "Fleet Updated" : "Error"}
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

const STATUS_TRANSITION: Record<DispatchStatus, DispatchStatus> = {
  planned: "in_transit",
  in_transit: "arrived",
  arrived: "completed",
  completed: "completed",
  cancelled: "cancelled",
};

const STATUS_LABEL: Record<DispatchStatus, string> = {
  planned: "Planned",
  in_transit: "In Transit",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<DispatchStatus, string> = {
  planned: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  in_transit: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  arrived: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  completed: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
  cancelled: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

function normalizeStatus(rawStatus: string | null | undefined): DispatchStatus {
  if (!rawStatus) return "planned";
  const lower = rawStatus.toLowerCase();
  if (
    lower === "planned" ||
    lower === "in_transit" ||
    lower === "arrived" ||
    lower === "completed" ||
    lower === "cancelled"
  ) {
    return lower as DispatchStatus;
  }
  if (lower === "en_route" || lower === "in-transit") {
    return "in_transit";
  }
  return "planned";
}

function formatTenantName(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(timestamp: string | null): string {
  if (!timestamp) return "Unknown";
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(navigator.language || "en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return timestamp;
  }
}

export default function DriverDashboardPage() {
  const params = useParams();
  const tenant = (params?.tenant as string) || "unknown";
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [dispatchRows, setDispatchRows] = useState<DispatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ open: true, message, type });
  };

  const closeToast = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  const filteredDispatches = useMemo(() => {
    if (!user) return [];
    return dispatchRows.filter((dispatch) => dispatch.driver_name === user.name);
  }, [dispatchRows, user]);

  const counts = useMemo(() => {
    return {
      total: filteredDispatches.length,
      planned: filteredDispatches.filter((dispatch) => dispatch.status === "planned")
        .length,
      active: filteredDispatches.filter(
        (dispatch) =>
          dispatch.status === "in_transit" || dispatch.status === "arrived",
      ).length,
      completed: filteredDispatches.filter(
        (dispatch) => dispatch.status === "completed",
      ).length,
    };
  }, [filteredDispatches]);

  useEffect(() => {
    let isMounted = true;

    async function loadDriverWorkspace() {
      setLoading(true);
      setError(null);

      try {
        const currentHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
        const currentProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
        const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;
        const client = createApiClient({ baseUrl: backendBaseUrl });

        const [authResponse, dispatchResponse] = await Promise.all([
          client.get<AuthMeEnvelope>("/auth/me", {
            headers: { "X-Tenant-ID": tenant },
          }),
          client.get<DispatchesEnvelope>("/dispatches", {
            headers: { "X-Tenant-ID": tenant },
          }),
        ]);

        if (authResponse.status !== 200 || !authResponse.data?.data) {
          throw new Error("Unable to verify active driver identity.");
        }

        const activeUser = authResponse.data.data;
        if (activeUser.role !== "driver") {
          if (isMounted) {
            setIsRedirecting(true);
            router.replace(buildTenantAwarePath("/dashboard", tenant));
          }
          return;
        }

        if (
          dispatchResponse.status !== 200 ||
          !Array.isArray(dispatchResponse.data?.data)
        ) {
          throw new Error("Failed to synchronize assigned manifest data.");
        }

        const normalizedDispatches = dispatchResponse.data.data.map((dispatch) => ({
          ...dispatch,
          status: normalizeStatus(dispatch.status as string),
        }));

        if (isMounted) {
          setUser(activeUser);
          setDispatchRows(normalizedDispatches);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message =
            err instanceof Error ? err.message : "Unexpected synchronization failure.";
          setError(message);
          showToast(message, "error");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDriverWorkspace();

    return () => {
      isMounted = false;
    };
  }, [router, tenant]);

  const advanceStatus = async (dispatchId: string, currentStatus: DispatchStatus) => {
    const nextStatus = STATUS_TRANSITION[currentStatus];
    if (nextStatus === currentStatus) return;

    try {
      setError(null);
      setIsSubmitting(true);
      setAdvancingId(dispatchId);

      const currentHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const currentProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;
      const client = createApiClient({ baseUrl: backendBaseUrl });

      const response = await client.patch<any>(
        `/dispatches/${dispatchId}/status`,
        { status: nextStatus },
        { headers: { "X-Tenant-ID": tenant } },
      );

      if (response.status === 200 && response.data?.data) {
        setDispatchRows((current) =>
          current.map((dispatch) =>
            String(dispatch.id) === String(dispatchId)
              ? { ...dispatch, status: normalizeStatus(response.data.data.status) }
              : dispatch,
          ),
        );
        showToast("Fleet state advanced successfully.", "success");
      } else {
        throw new Error("The operational gateway rejected this status progression.");
      }
    } catch (err: unknown) {
      console.error("[Driver Telemetry] Status update failure:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to broadcast real-time telemetry.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
      setAdvancingId(null);
    }
  };

  const primaryButtonLabel = (status: DispatchStatus) => {
    if (status === "planned") return "Start Run";
    if (status === "in_transit") return "Mark Arrived";
    if (status === "arrived") return "Complete Drop";
    return "Trip Completed";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-300">
        <div className="flex items-center gap-3 rounded-3xl border border-zinc-800/80 bg-zinc-900/80 px-5 py-4 shadow-xl shadow-black/30">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
          <span className="text-sm">Loading driver workspace...</span>
        </div>
      </div>
    );
  }

  if (!loading && user && user.role !== "driver") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-200">
        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2.5 text-sm text-zinc-300 shadow-lg shadow-black/20">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
          Redirecting to authorized dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-xl">
        <header className="mb-5 rounded-3xl border border-zinc-800/70 bg-zinc-900/85 p-5 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                Driver Workspace
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">
                {formatTenantName(tenant)} Driver Cockpit
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Track assigned runs, update manifest status, and keep the operations
                flow current.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-xs text-zinc-400">
                <p className="font-medium text-zinc-200">
                  {user?.name ?? "Driver"}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  Authenticated
                </p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </header>

        <section className="mb-5 space-y-4 rounded-3xl border border-zinc-800/70 bg-zinc-900/80 p-4 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Assigned manifest
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-100">
                {counts.total} active trips
              </h2>
            </div>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
              Driver mode
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-zinc-800/60 bg-zinc-950/80 p-4 text-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Planned
              </p>
              <p className="mt-3 text-2xl font-semibold text-amber-200">
                {counts.planned}
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-800/60 bg-zinc-950/80 p-4 text-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Active
              </p>
              <p className="mt-3 text-2xl font-semibold text-emerald-200">
                {counts.active}
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-800/60 bg-zinc-950/80 p-4 text-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Completed
              </p>
              <p className="mt-3 text-2xl font-semibold text-zinc-200">
                {counts.completed}
              </p>
            </div>
          </div>
        </section>

        {filteredDispatches.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/80 p-6 text-center text-sm text-zinc-400">
            <p className="text-zinc-200">
              No assigned deliveries found for your driver profile.
            </p>
            <p className="mt-2">
              If you believe this is incorrect, contact your operations dispatcher.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDispatches.map((dispatch) => (
              <article
                key={dispatch.id}
                className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl rounded-3xl p-5 mb-4 shadow-xl"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                      Trip Reference
                    </p>
                    <p className="mt-2 text-base font-semibold text-zinc-100">
                      {dispatch.reference_code}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[dispatch.status]}`}
                  >
                    {STATUS_LABEL[dispatch.status]}
                  </span>
                </div>

                <div className="space-y-3 text-sm text-zinc-300">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-3xl bg-zinc-950/70 p-3">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                        Warehouse
                      </p>
                      <p className="mt-2 font-medium text-zinc-100">
                        {dispatch.warehouse?.name || "Unknown hub"}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-zinc-950/70 p-3">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                        Vehicle
                      </p>
                      <p className="mt-2 font-medium text-zinc-100">
                        {dispatch.vehicle_identifier || "Unassigned"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-3xl bg-zinc-950/70 p-3">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                        Scheduled
                      </p>
                      <p className="mt-2 font-medium text-zinc-100">
                        {formatDateTime(dispatch.scheduled_at)}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-zinc-950/70 p-3">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                        Stops
                      </p>
                      <p className="mt-2 font-medium text-zinc-100">
                        {dispatch.stops?.length ?? 0} stops
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => advanceStatus(dispatch.id, dispatch.status)}
                  disabled={
                    dispatch.status === "completed" ||
                    (isSubmitting && advancingId === dispatch.id)
                  }
                  className={`mt-5 w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition duration-200 ${
                    dispatch.status === "completed"
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50 shadow-none"
                      : "bg-gradient-to-r from-emerald-400 to-emerald-500 text-zinc-950 hover:from-emerald-300 hover:to-emerald-400 active:scale-[0.99] shadow-xl shadow-black/10 disabled:cursor-not-allowed disabled:opacity-60"
                  }`}
                >
                  {isSubmitting && advancingId === dispatch.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950" />
                      Advancing Fleet State...
                    </span>
                  ) : (
                    primaryButtonLabel(dispatch.status)
                  )}
                </button>
              </article>
            ))}
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