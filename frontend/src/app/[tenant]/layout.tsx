"use client";

import { usePathname } from "next/navigation";
import { GlobalTopNav } from "@/components/dashboard/GlobalTopNav";

interface TenantLayoutProps {
  children: React.ReactNode;
  params: { tenant: string };
}

export default function TenantLayout({ children, params }: TenantLayoutProps) {
  const pathname = usePathname();
  const isLoginRoute = pathname?.endsWith("/login");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
      {!isLoginRoute && <GlobalTopNav tenantSlug={params?.tenant} />}
      <main className="relative">{children}</main>
    </div>
  );
}
