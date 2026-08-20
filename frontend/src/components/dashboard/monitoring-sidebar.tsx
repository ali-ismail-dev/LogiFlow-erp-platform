"use client";

import type { AuthUser } from "@/hooks/useRBAC";

interface MonitoringSidebarProps {
  usersRoster?: AuthUser[];
}

export function MonitoringSidebar({
  usersRoster = [],
}: MonitoringSidebarProps) {
  // Filters out non-driver entries exactly to synchronize profile cards cleanly
  const activeDrivers = usersRoster.filter(
    (u) => String(u.role).toLowerCase() === "driver"
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Active Drivers Roster Panel */}
      <section>
        <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Active Drivers
        </p>
        <div className="flex flex-col gap-2">
          {activeDrivers.length === 0 && (
            <p className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-xs text-zinc-600">
              No drivers currently active inside this organization.
            </p>
          )}
          {activeDrivers.map((driver) => (
            <div
              key={driver.id}
              className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 backdrop-blur-xl transition-all duration-200 hover:border-zinc-700/60"
            >
              <div className="min-w-0 flex-1 pr-2">
                <p className="truncate text-sm font-medium text-zinc-200">
                  {driver.name ?? "Unassigned Operative"}
                </p>
                <p className="font-mono text-[11px] tracking-tight text-zinc-500">
                  {driver.email ?? "No address listed"}
                </p>
              </div>
              <span className="relative flex h-2 w-2 flex-none">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
