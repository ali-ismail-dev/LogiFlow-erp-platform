"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRBAC, ROLE_LABELS } from "@/hooks/useRBAC";
import { LogoutButton } from "./LogoutButton";

interface GlobalTopNavProps {
  tenantSlug: string;
}

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function formatTenantName(tenant: string): string {
  if (!tenant) return "Logistics Workspace";
  return tenant
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAvatarInitials(name: string | undefined): string {
  if (!name) return "OP";

  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return initials.slice(0, 2) || "OP";
}

export function GlobalTopNav({ tenantSlug }: GlobalTopNavProps) {
  const { user, role, loading, isDriver } = useRBAC({ tenantSlug });
  const tenantPath = `/${tenantSlug}`;
  const menuRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  }

  useEffect(() => {
    function closeMenuOnOutsidePointer(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    }

    document.addEventListener("pointerdown", closeMenuOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeMenuOnOutsidePointer);
  }, []);

  if (loading || !user) {
    return null;
  }

  const navigationItems: NavigationItem[] = [
    {
      href: `${tenantPath}/dashboard`,
      label: "Dashboard Cockpit",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="2" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="2" y="8" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="8" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      href: `${tenantPath}/warehouses`,
      label: "Facility Hub Portal",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 13V3h10v10M1 13h12M5 6h4M5 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: `${tenantPath}/orders/new`,
      label: "Cargo Order Intake",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 4h8l1 6H2L3 4Zm3 4h2M4 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: `${tenantPath}/vehicles`,
      label: "Fleet Equipment Board",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7L4 3h4l2 4M3 7v4h8V7M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: `${tenantPath}/drivers`,
      label: "Operative Directory Board",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 13c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5M9 4a2 2 0 100-4 2 2 0 000 4ZM13 13c0-1.5-.8-2.6-2-3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: `${tenantPath}/employees`,
      label: "Employee Directory Board",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 13c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5M10 5a2 2 0 100-4 2 2 0 000 4ZM10 9.5c1.8.2 3 1.5 3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: `${tenantPath}/dispatches/new`,
      label: "Route Composition Wizard",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 3h4l2 4h4M2 11h4l2-4h4M2 3v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="2" cy="3" r="1" fill="currentColor" />
          <circle cx="12" cy="7" r="1" fill="currentColor" />
          <circle cx="2" cy="11" r="1" fill="currentColor" />
        </svg>
      ),
    },
  ];

  const roleLabel = role ? ROLE_LABELS[role] : "Verifying clearance...";
  const roleBadgeClass = role === "super_admin"
    ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-300"
    : role === "dispatcher"
      ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
      : role === "warehouse_manager"
        ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
        : "border-zinc-500/60 bg-zinc-500/10 text-zinc-400";

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`${tenantPath}/dashboard`} className="flex items-center gap-3" aria-label="Open dashboard cockpit">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-emerald-400" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 2L15.5 5.75V12.25L9 16L2.5 12.25V5.75L9 2ZM9 11.5L12.5 9.5V6.5L9 8.5L5.5 6.5V9.5L9 11.5Z" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-50">{formatTenantName(tenantSlug)}</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Operations Cockpit</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <div className="group relative hidden min-w-[170px] items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-1 pr-4 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/40 hover:shadow-emerald-500/10 sm:flex">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-400/20 to-cyan-400/20">
              <span className="text-[11px] font-bold tracking-wider text-emerald-100">{getAvatarInitials(user?.name)}</span>
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-xs font-semibold text-zinc-100">{user?.name || "Loading Operator..."}</span>
              <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${roleBadgeClass}`}>
                {roleLabel}
              </span>
            </div>
          </div>

          {!loading && !isDriver && (
            <details ref={menuRef} className="group relative">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 transition-all duration-200 hover:border-emerald-400/40 hover:bg-zinc-900 hover:shadow-lg hover:shadow-emerald-500/10 open:border-emerald-400/40 open:bg-zinc-900 [&::-webkit-details-marker]:hidden">
                <span className="sr-only">Open navigation menu</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-zinc-300 transition-colors group-hover:text-emerald-300" aria-hidden="true">
                  <path d="M2 8h12M2 4h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </summary>
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Command Sector</p>
                <nav className="flex flex-col gap-1" aria-label="Tenant navigation">
                  {navigationItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={closeMenu} className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-zinc-300 transition-all duration-200 hover:bg-zinc-900 hover:text-emerald-300">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-500 transition-colors group-hover:border-emerald-400/30 group-hover:text-emerald-300">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-2 border-t border-zinc-800 pt-2">
                  <LogoutButton />
                </div>
              </div>
            </details>
          )}
        </div>
      </div>
    </header>
  );
}
