"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createApiClient } from "@/lib/api/apiClient";
import { useRBAC, ROLE_LABELS, type UserRole } from "@/hooks/useRBAC";
import { buildTenantAwarePath } from "@/lib/tenant-routing";

interface TeamMember {
  id: number | string;
  name: string;
  email: string;
  tenant_id: number | string;
  role: UserRole;
}

interface UserResponseEnvelope {
  data: TeamMember[] | TeamMember;
}

interface ToastState {
  open: boolean;
  message: string;
  type: "success" | "error";
}

function extractApiErrorMessage(error: unknown): string | null {
  const candidate = error as {
    response?: { data?: unknown };
    message?: unknown;
  };
  const payload = candidate?.response?.data ?? error;

  if (!payload || typeof payload !== "object") {
    return typeof candidate?.message === "string" ? candidate.message : null;
  }

  const data = payload as {
    message?: unknown;
    errors?: Record<string, unknown>;
  };
  const emailErrors = data.errors?.email;

  if (Array.isArray(emailErrors) && typeof emailErrors[0] === "string") {
    return emailErrors[0];
  }

  return typeof data.message === "string" ? data.message : null;
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

export default function EmployeesPage() {
  const params = useParams();
  const router = useRouter();
  const tenant = (params?.tenant as string) || "unknown";

  const { can, loading: rbacLoading } = useRBAC();
  const canManageTeam = can("invite_users");
  const dashboardHref = buildTenantAwarePath("/dashboard", tenant);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formName, setFormName] = useState<string>("");
  const [formEmail, setFormEmail] = useState<string>("");
  const [formRole, setFormRole] = useState<UserRole>("dispatcher");
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

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const currentHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const currentProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;

      const client = createApiClient({
        baseUrl: backendBaseUrl,
      });

      const response = await client.get<UserResponseEnvelope>("/users", {
        headers: {
          "X-Tenant-ID": tenant,
        },
      });

      if (response.status === 200 && response.data?.data) {
        const payload = response.data.data;
        const normalizedRows = Array.isArray(payload) ? payload : [payload];
        setMembers(normalizedRows);
        setCurrentPage(1);
      } else {
        throw new Error("Failed to parse team roster records.");
      }
    } catch (err: any) {
      console.error("[Employee Roster] Fetch exception caught:", err);
      showToast(
        err?.response?.data?.message ||
          err.message ||
          "Failed to load employee team catalog.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [tenant, showToast]);

  useEffect(() => {
    if (!rbacLoading && canManageTeam) {
      fetchRoster();
    }
  }, [rbacLoading, canManageTeam, fetchRoster]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setFormSuccess(false);

    try {
      const currentHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const currentProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;

      const client = createApiClient({
        baseUrl: backendBaseUrl,
      });

      const response = await client.post<UserResponseEnvelope>(
        "/users",
        {
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
        },
        {
          headers: {
            "X-Tenant-ID": tenant,
          },
        },
      );

      if (response.status < 200 || response.status >= 300) {
        showToast(
          extractApiErrorMessage(response.data) ||
            "The corporate email address is already registered in this workspace.",
          "error",
        );
        return;
      }

      if (response.status === 200 || response.status === 201) {
        setFormSuccess(true);
        setFormName("");
        setFormEmail("");
        setFormRole("dispatcher");

        await fetchRoster();

        showToast("Employee profile provisioned successfully.", "success");

        setTimeout(() => {
          setIsModalOpen(false);
          setFormSuccess(false);
        }, 1500);
      }
    } catch (err: any) {
      console.error("[Employee Roster] Invite mutation crash:", err);
      showToast(
        extractApiErrorMessage(err) ||
          "Failed to provision workspace account credentials.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleMembers = members.slice(startIndex, endIndex);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.min(Math.max(1, page), totalPages));
    },
    [totalPages],
  );

  if (!rbacLoading && !canManageTeam) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100">
        <p className="font-mono text-xs uppercase tracking-widest text-rose-500">
          Security Access Violation
        </p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-200">
          Unauthorized Perimeter Entry
        </h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          Your active session role does not possess permissions to audit user
          configurations. Contact your organization administrator.
        </p>
        <Link
          href={dashboardHref}
          className="mt-5 text-xs text-emerald-400 underline hover:text-emerald-300"
        >
          Return to Cockpit Dashboard
        </Link>
      </div>
    );
  }

  if (rbacLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 pb-6">
            <div className="space-y-3">
              <div className="h-4 w-28 animate-pulse rounded-xl bg-zinc-900/40" />
              <div className="h-8 w-64 animate-pulse rounded-xl bg-zinc-900/40" />
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
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 pb-6">
          <div>
            <Link
              href={dashboardHref}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              ← Dashboard Cockpit
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Team Directory
            </h1>
            <p className="text-xs text-zinc-500">
              Manage and monitor administrative access tokens for {tenant}{" "}
              workspace.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-md transition-all hover:from-emerald-300 hover:to-emerald-400 active:scale-95"
          >
            + Provision Team Access
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-950/40 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                <th className="px-6 py-4">Employee Name</th>
                <th className="px-6 py-4">Corporate Email Identity</th>
                <th className="px-6 py-4">Security Level Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-sm">
              {visibleMembers.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-zinc-900/30 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-zinc-200">
                    {member.name}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                    {member.email}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase font-mono tracking-wider ${
                        member.role === "super_admin"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : member.role === "dispatcher"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : member.role === "warehouse_manager"
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                      }`}
                    >
                      {ROLE_LABELS[member.role] || member.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination control bar */}
        <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between text-xs mt-4">
          <span className="text-zinc-500">
            Showing{" "}
            <span className="font-mono text-zinc-300">{startIndex + 1}</span> to{" "}
            <span className="font-mono text-zinc-300">
              {Math.min(endIndex, members.length)}
            </span>{" "}
            of{" "}
            <span className="font-mono text-zinc-300">{members.length}</span>{" "}
            team members
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

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              {formSuccess ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="text-3xl text-emerald-400 animate-bounce">
                    ✓
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-emerald-400">
                    Account Provisioned Successfully
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Updating corporate identity database rosters...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-50">
                      Invite Team Member
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Provide personal employee parameters to drop new access
                      cookies.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                      Full Operational Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Marcus Vance"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                      Corporate Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="operator@nike.logiflow"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                      System Permission Role
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as UserRole)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                    >
                      <option value="dispatcher">Dispatcher</option>
                      <option value="warehouse_manager">Warehouse Manager</option>
                      <option value="driver">Driver</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      disabled={isSubmitting}
                      className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-xs font-semibold hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
                          Provisioning employee profile...
                        </>
                      ) : (
                        "Send Invitation"
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