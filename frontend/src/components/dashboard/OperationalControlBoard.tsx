"use client";

import { useRouter } from "next/navigation";
import {
  Truck,
  Users,
  Route,
  Package,
  Building2,
  ArrowRight,
} from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";
import { buildTenantAwarePath } from "@/lib/tenant-routing";

interface OperationalControlBoardProps {
  tenantSlug: string;
}

interface BoardItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  bgGradient: string;
  borderColor: string;
  borderHover: string;
  iconBg: string;
  iconHoverBg: string;
}

export function OperationalControlBoard({
  tenantSlug,
}: OperationalControlBoardProps) {
  const router = useRouter();
  const { isSuperAdmin, isDispatcher, isWarehouseManager } = useRBAC();

  const controlItems: BoardItem[] = [
    {
      id: "vehicles",
      title: "Fleet Equipment Board",
      description: "Audit cargo van transport assets and monitor vehicle status",
      icon: Truck,
      href: buildTenantAwarePath("/vehicles", tenantSlug),
      bgGradient: "from-blue-500/20 to-blue-600/20",
      borderColor: "border-blue-700/40",
      borderHover: "hover:border-blue-500/60",
      iconBg: "bg-blue-500/10",
      iconHoverBg: "group-hover:bg-blue-500/20",
    },
    {
      id: "drivers",
      title: "Operative Directory Board",
      description: "Link active commercial operator accounts and manage driver roster",
      icon: Users,
      href: buildTenantAwarePath("/drivers", tenantSlug),
      bgGradient: "from-emerald-500/20 to-emerald-600/20",
      borderColor: "border-emerald-700/40",
      borderHover: "hover:border-emerald-500/60",
      iconBg: "bg-emerald-500/10",
      iconHoverBg: "group-hover:bg-emerald-500/20",
    },
    {
      id: "dispatches",
      title: "Route Composition Wizard",
      description: "Bundle pending unassigned orders and create new dispatch routes",
      icon: Route,
      href: buildTenantAwarePath("/dispatches/new", tenantSlug),
      bgGradient: "from-purple-500/20 to-purple-600/20",
      borderColor: "border-purple-700/40",
      borderHover: "hover:border-purple-500/60",
      iconBg: "bg-purple-500/10",
      iconHoverBg: "group-hover:bg-purple-500/20",
    },
    {
      id: "employees",
      title: "Corporate Employees Board",
      description: "Manage team directory, roles, and organizational structure",
      icon: Building2,
      href: buildTenantAwarePath("/employees", tenantSlug),
      bgGradient: "from-amber-500/20 to-amber-600/20",
      borderColor: "border-amber-700/40",
      borderHover: "hover:border-amber-500/60",
      iconBg: "bg-amber-500/10",
      iconHoverBg: "group-hover:bg-amber-500/20",
    },
    {
      id: "warehouses",
      title: "Facility Hub Portal",
      description: "Register and monitor fulfillment facilities across the active network",
      icon: Building2,
      href: buildTenantAwarePath("/warehouses", tenantSlug),
      bgGradient: "from-cyan-500/20 to-cyan-600/20",
      borderColor: "border-cyan-700/40",
      borderHover: "hover:border-cyan-500/60",
      iconBg: "bg-cyan-500/10",
      iconHoverBg: "group-hover:bg-cyan-500/20",
    },
    {
      id: "order-intake",
      title: "Cargo Order Intake",
      description: "Manually ingest new corporate client cargo orders into the unassigned queue",
      icon: Package,
      href: buildTenantAwarePath("/orders/new", tenantSlug),
      bgGradient: "from-cyan-500/20 to-cyan-600/20",
      borderColor: "border-cyan-700/40",
      borderHover: "hover:border-cyan-500/60",
      iconBg: "bg-cyan-500/10",
      iconHoverBg: "group-hover:bg-cyan-500/20",
    },
  ];

  const visibleControlItems = controlItems.filter((item) => {
    if (isSuperAdmin) {
      return true;
    }

    if (isDispatcher) {
      return ["vehicles", "drivers", "dispatches", "order-intake", "warehouses"].includes(item.id);
    }

    if (isWarehouseManager) {
      return ["warehouses", "order-intake"].includes(item.id);
    }

    return false;
  });

  const handleNavigate = (href: string) => {
    router.push(href);
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
            Operational Control Board
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Navigate all functional sectors and manage core operational domains
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {visibleControlItems.map((item) => {
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.href)}
              className={`group relative overflow-hidden rounded-lg border bg-gradient-to-br px-4 py-5 text-left transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 ${item.bgGradient} ${item.borderColor} ${item.borderHover}`}
            >
              {/* Animated glow effect on hover */}
              <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0" />
              </div>

              <div className="relative z-10">
                {/* Icon */}
                <div className={`mb-3 inline-block rounded-lg ${item.iconBg} p-3 backdrop-blur-sm transition-all duration-300 ${item.iconHoverBg} group-hover:shadow-lg group-hover:shadow-emerald-500/20`}>
                  <IconComponent className="h-5 w-5 text-zinc-300 transition-colors duration-300 group-hover:text-emerald-400" />
                </div>

                {/* Title */}
                <h3 className="mb-1.5 font-semibold text-zinc-100 transition-colors duration-300 group-hover:text-emerald-300">
                  {item.title}
                </h3>

                {/* Description */}
                <p className="mb-4 text-xs text-zinc-400 transition-colors duration-300 group-hover:text-zinc-300">
                  {item.description}
                </p>

                {/* CTA Arrow */}
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 transition-all duration-300 group-hover:gap-3 group-hover:text-emerald-400">
                  <span>Access Board</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
