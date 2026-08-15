"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
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
export function DashboardSecurityBoundary({ tenant, children }: DashboardSecurityBoundaryProps) {
  const router = useRouter();
  const { isDriver, loading: rbacLoading } = useRBAC();

  useEffect(() => {
    // Perform security check only after RBAC data is loaded
    if (!rbacLoading && isDriver) {
      // Subdomain-aware bounce: route directly to driver dashboard
      const driverDashboardPath = buildTenantAwarePath("/driver/dashboard", tenant);
      router.replace(driverDashboardPath);
    }
  }, [rbacLoading, isDriver, router, tenant]);

  // While performing RBAC check or during redirect, show loading state
  if (rbacLoading || isDriver) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-200">
        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2.5 text-sm text-zinc-300 shadow-lg shadow-black/20">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
          Verifying dashboard permissions...
        </div>
      </div>
    );
  }

  // Authorization check passed, render dashboard content
  return <>{children}</>;
}
