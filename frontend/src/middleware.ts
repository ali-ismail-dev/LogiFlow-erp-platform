// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Phase 1 — Global Router Guard.
 *
 * This middleware preserves the existing tenant subdomain → `/[tenant]` rewriting
 * (routing concern) and layers a strict session-cookie guard on top (security
 * concern). Protected workspace paths (`dashboard`, `dispatches`) are only served
 * when a stateful Laravel session cookie is present; otherwise the browser is
 * bounced to that tenant's own login perimeter.
 */

/** Hosts that represent the platform root, never a tenant. */
const ROOT_HOSTS = new Set(["localhost:3000", "logiflow.com", "www.logiflow.com"]);

/**
 * Candidate names for the stateful Laravel session cookie.
 *
 * Laravel's default is `Str::slug(env('APP_NAME')) . '-session'`, which resolves
 * to `laravel_session` or `logiflow_session` depending on APP_NAME. We check the
 * candidate set (plus the hyphenated variant) so the guard stays robust across
 * environment overrides. The cookie is host-only (no Domain attribute), so it is
 * shared across ports on the same tenant subdomain — exactly what lets the
 * port-3001 Next.js app observe a session minted via the port-8000 gateway.
 */
const SESSION_COOKIE_NAMES: ReadonlySet<string> = new Set([
  "laravel_session",
  "logiflow_session",
  "logiflow-session",
]);

/** Top-level path segments that require a valid session. */
const PROTECTED_SEGMENTS: ReadonlySet<string> = new Set(["dashboard", "dispatches"]);

/**
 * Returns true when the request carries at least one recognized stateful session
 * cookie. Edge middleware runs on Vercel/Node runtimes, so we read directly from
 * the raw `Cookie` header rather than relying on a browser `document.cookie`.
 */
function hasSessionCookie(request: NextRequest): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  let found = false;
  // .forEach avoids for...of Set iteration, which would require the
  // --downlevelIteration flag / an es2015+ target in the tsconfig.
  SESSION_COOKIE_NAMES.forEach((name) => {
    // Match the cookie name at a boundary (start-of-header or after '; ').
    const pattern = new RegExp(`(?:^|;\\s*)${name}=`);
    if (pattern.test(cookieHeader)) {
      found = true;
    }
  });
  return found;
}

/**
 * Determines whether a pathname targets a protected workspace route and, if so,
 * returns the tenant slug guarding it (from either the path or the host).
 */
function protectedRouteTenant(request: NextRequest, fallbackTenant: string | null): string | null {
  const pathname = request.nextUrl.pathname;
  const segments = pathname.split("/").filter(Boolean);

  // Shape: /<tenant>/dashboard/... or /<tenant>/dispatches/...
  if (segments.length >= 2 && PROTECTED_SEGMENTS.has(segments[1])) {
    return segments[0];
  }

  // Shape (root-host access): /dashboard/... or /dispatches/... — gate by the
  // host-derived tenant if one exists.
  if (segments.length >= 1 && PROTECTED_SEGMENTS.has(segments[0])) {
    return fallbackTenant;
  }

  return null;
}

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
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const tenant = resolveTenantSlug(host);

  const url = request.nextUrl.clone();

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1 SECURITY PERIMETER — Session guard for protected workspace paths.
  //
  // Run BEFORE any rewriting so we can reason about both the raw path and the
  // host-derived tenant. If a protected route is reached without a stateful
  // Laravel session cookie, bounce the browser to that tenant's own login.
  // ─────────────────────────────────────────────────────────────────────────
  const protectedTenant = protectedRouteTenant(request, tenant);
  if (protectedTenant && !hasSessionCookie(request)) {
    const loginUrl = url.clone();
    loginUrl.pathname = `/${protectedTenant}/login`;
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // No resolvable tenant — serve the platform-level route tree untouched.
  if (!tenant) {
    return NextResponse.next();
  }

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