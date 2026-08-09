"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createApiClient } from "@/lib/api/apiClient";
import { useRBAC, ROLE_LABELS, type UserRole } from "@/hooks/useRBAC";

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

export default function EmployeesPage() {
  const params = useParams();
  const router = useRouter();
  const tenant = (params?.tenant as string) || "unknown";

  const { can, loading: rbacLoading } = useRBAC();
  const canManageTeam = can("invite_users");

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formName, setFormName] = useState<string>("");
  const [formEmail, setFormEmail] = useState<string>("");
  const [formRole, setFormRole] = useState<UserRole>("dispatcher");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formSuccess, setFormRoleSuccess] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentHostname = window.location.hostname;
      const currentProtocol = window.location.protocol;
      const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;

      const client = createApiClient({
        baseUrl: backendBaseUrl
      });

      const response = await client.get<UserResponseEnvelope>("/users", {
        headers: {
          "X-Tenant-ID": tenant
        }
      });

      if (response.status === 200 && response.data?.data) {
        const payload = response.data.data;
        const normalizedRows = Array.isArray(payload) ? payload : [payload];
        setMembers(normalizedRows);
      } else {
        throw new Error("Failed to parse team roster records.");
      }
    } catch (err: any) {
      console.error("[Employee Roster] Fetch exception caught:", err);
      setError(err?.response?.data?.message || err.message || "Failed to load employee team catalog.");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (!rbacLoading && canManageTeam) {
      fetchRoster();
    }
  }, [rbacLoading, canManageTeam, fetchRoster]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setFormError(null);
    setFormRoleSuccess(false);

    try {
      const currentHostname = window.location.hostname;
      const currentProtocol = window.location.protocol;
      const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;

      const client = createApiClient({
        baseUrl: backendBaseUrl
      });

      const response = await client.post<UserResponseEnvelope>("/users", {
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        role: formRole,
      }, {
        headers: {
          "X-Tenant-ID": tenant
        }
      });

      if (response.status === 200 || response.status === 201) {
        setFormRoleSuccess(true);
        setFormName("");
        setFormEmail("");
        setFormRole("dispatcher");
        
        await fetchRoster();

        setTimeout(() => {
          setIsModalOpen(false);
          setFormRoleSuccess(false);
        }, 1500);
      }
    } catch (err: any) {
      console.error("[Employee Roster] Invite mutation crash:", err);
      setFormError(err?.response?.data?.message || err?.message || "Failed to provision workspace account credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (rbacLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm font-mono text-zinc-400">
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
        Synchronizing workspace directory logs...
      </div>
    );
  }

  if (!canManageTeam) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100">
        <p className="font-mono text-xs uppercase tracking-widest text-rose-500">Security Access Violation</p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-200">Unauthorized Perimeter Entry</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          Your active session role does not possess permissions to audit user configurations. Contact your organization administrator.
        </p>
        <Link href={`/${tenant}/dashboard`} className="mt-5 text-xs text-emerald-400 underline hover:text-emerald-300">
          Return to Cockpit Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100 lg:px-12">
      <div className="mx-auto max-w-6xl">
        
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 pb-6">
          <div>
            <Link href={`/${tenant}/dashboard`} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
              ← Dashboard Cockpit
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Team Directory</h1>
            <p className="text-xs text-zinc-500">Manage and monitor administrative access tokens for {tenant} workspace.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-md transition-all hover:from-emerald-300 hover:to-emerald-400 active:scale-95"
          >
            + Provision Team Access
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-xs text-rose-400 font-mono">
            {error}
          </div>
        )}

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
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-zinc-200">{member.name}</td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-400">{member.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase font-mono tracking-wider ${
                      member.role === "super_admin" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      member.role === "dispatcher" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      member.role === "warehouse_manager" ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                      "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}>
                      {ROLE_LABELS[member.role] || member.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              {formSuccess ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="text-3xl text-emerald-400 animate-bounce">✓</span>
                  <h3 className="mt-2 text-sm font-semibold text-emerald-400">Account Provisioned Successfully</h3>
                  <p className="text-xs text-zinc-500 mt-1">Updating corporate identity database rosters...</p>
                </div>
              ) : (
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-50">Invite Team Member</h3>
                    <p className="text-xs text-zinc-500">Provide personal employee parameters to drop new access cookies.</p>
                  </div>

                  {formError && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400 font-mono">
                      {formError}
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Full Operational Name</label>
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
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Corporate Email Address</label>
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
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">System Permission Role</label>
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
                      className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? "Provisioning..." : "Send Invitation"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}