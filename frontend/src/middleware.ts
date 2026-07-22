// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

/** Hosts that represent the platform root, never a tenant. */
const ROOT_HOSTS = new Set(["localhost:3000", "logiflow.com", "www.logiflow.com"]);

/** Subdomains reserved for platform infrastructure — never treated as tenants. */
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "status"]);

/**
 * Resolves the tenant slug from a raw `Host` header.
 *
 * Supports local dev (`merchant-a.localhost:3000`) and production
 * (`merchant-a.logiflow.com`) hostname shapes. Returns `null` when the
 * request targets the platform root or a reserved subdomain.
 */
function resolveTenantSlug(host: string): string | null {
  if (ROOT_HOSTS.has(host)) return null;

  const hostname = host.split(":")[0]; // strip port, if present
  const labels = hostname.split(".");

  // Local dev shape:  <tenant>.localhost      → ["merchant-a", "localhost"]
  // Production shape: <tenant>.logiflow.com   → ["merchant-a", "logiflow", "com"]
  const isLocalTenantHost = labels.length === 2 && labels[1] === "localhost";
  const isProdTenantHost = labels.length >= 3;

  if (!isLocalTenantHost && !isProdTenantHost) return null;

  const candidate = labels[0];
  if (!candidate || RESERVED_SUBDOMAINS.has(candidate)) return null;

  return candidate;
}

export function middleware(request: NextRequest) {
  // Docker / reverse-proxy setups often rewrite the original Host header —
  // x-forwarded-host is the more reliable source when one is present.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const tenant = resolveTenantSlug(host);

  // No resolvable tenant — serve the platform-level route tree untouched.
  if (!tenant) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();

  // Guard against double-rewriting a request that's already tenant-namespaced.
  if (url.pathname === `/${tenant}` || url.pathname.startsWith(`/${tenant}/`)) {
    return NextResponse.next();
  }

  // Internally namespace under the `[tenant]` dynamic segment while leaving
  // request.nextUrl / the browser's address bar untouched — this is what
  // keeps `merchant-a.localhost:3000/dashboard` visually clean.
  url.pathname = `/${tenant}${url.pathname}`;

  const response = NextResponse.rewrite(url);
  response.headers.set("x-tenant-slug", tenant);
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every route except:
     *  - Next.js internals (_next/static, _next/image)
     *  - common static assets (favicon, sitemap, robots, any file with an extension)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};