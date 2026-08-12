export function isTenantSubdomainActive(
  hostname: string | null | undefined,
  tenantSlug?: string | null,
): boolean {
  const host = String(hostname ?? "").trim().toLowerCase();
  const tenant = String(tenantSlug ?? "").trim().toLowerCase();

  if (!host || !tenant || tenant === "null" || tenant === "undefined") {
    return false;
  }

  const normalizedHost = host.split(":")[0];
  return normalizedHost === tenant || normalizedHost.startsWith(`${tenant}.`);
}

export function buildTenantAwarePath(pathname: string, tenantSlug?: string | null): string {
  const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const tenant = String(tenantSlug ?? "").trim();

  if (!tenant || tenant === "null" || tenant === "undefined") {
    return safePath;
  }

  if (isTenantSubdomainActive(typeof window !== "undefined" ? window.location.hostname : "", tenant)) {
    return safePath;
  }

  return `/${tenant}${safePath}`;
}

export function getSubdomainAwareRoute(
  tenantSlug: string | null | undefined,
  path: string,
): string {
  return buildTenantAwarePath(path, tenantSlug);
}
