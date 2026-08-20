"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRBAC } from "@/hooks/useRBAC";
import { buildTenantAwarePath } from "@/lib/tenant-routing";

interface DashboardSecurityBoundaryProps {
  tenant: string;
  children: ReactNode;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DashboardSecurityBoundary
 *
 * Client-side RBAC security perimeter for the main admin dashboard.
 * Enforces fail-closed access control: if the authenticated user's role
 * is exactly "driver", they are immediately bounced to their designated
 * mobile cockpit location via router.replace().
 *
 * Accounts for subdomain-aware routing: if the active hostname carries
 * the tenant subdomain prefix, links route straight to `/driver/dashboard`
 * instead of compounding a duplicate path segment.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function DashboardSecurityBoundary({
  tenant,
  children,
}: DashboardSecurityBoundaryProps) {
  const router = useRouter();
  const {
    user,
    isDriver,
    loading: rbacLoading,
  } = useRBAC({ tenantSlug: tenant });

  useEffect(() => {
    // Perform security check only after RBAC data is loaded
    if (!rbacLoading && !user) {
      router.replace(buildTenantAwarePath("/login", tenant));
      return;
    }

    if (!rbacLoading && isDriver) {
      // Subdomain-aware bounce: route directly to driver dashboard
      const driverDashboardPath = buildTenantAwarePath(
        "/driver/dashboard",
        tenant,
      );
      router.replace(driverDashboardPath);
    }
  }, [rbacLoading, isDriver, router, tenant, user]);

  // While RBAC data is still loading, render a premium glassmorphic spinner
  if (rbacLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-200">
        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/80 px-5 py-3 text-sm text-zinc-300 shadow-xl shadow-black/20">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
          Verifying cryptographic workspace credentials...
        </div>
      </div>
    );
  }

  // If no authenticated user is available, render nothing while redirecting.
  if (!user) {
    return null;
  }

  // If the authenticated user is a driver, render the security exclusion panel
  // while the redirect is in flight.
  if (isDriver) {
    const authorizedDashboardPath = buildTenantAwarePath("/dashboard", tenant);

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-50">
        <div className="w-full max-w-xl rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/15 text-2xl text-rose-300">
            !
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300">
            Security Perimeter Exclusion
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Unauthorized Dashboard Access
          </h1>
          <p className="mt-3 text-sm text-rose-100/80">
            Your active session role does not possess clearance to enter this
            operational area. Redirecting you to your authorized workspace...
          </p>
          <Link
            href={authorizedDashboardPath}
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-rose-400/30 bg-zinc-950/40 px-5 py-2.5 text-sm font-medium text-rose-200 transition hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-white"
          >
            Return to authorized dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Authorization check passed, render dashboard content
  return <>{children}</>;
}