// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Phase 1 — Global Router Guard.
 *
 * This middleware preserves the existing tenant subdomain → `/[tenant]` rewriting
 * (routing concern) and layers a strict session-cookie guard on top (security
 * concern). Protected workspace paths are only served when a stateful Laravel
 * session cookie is present; otherwise the browser is bounced to that tenant's
 * own login perimeter.
 */

/** Hosts that represent the platform root, never a tenant. */
const ROOT_HOSTS = new Set(["localhost:3000", "logiflow.com", "://logiflow.com"]);

/** Subdomains reserved for platform infrastructure — never treated as tenants. */
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "status"]);

/**
 * Candidate names for the stateful Laravel session cookie.
 */
const SESSION_COOKIE_NAMES: ReadonlySet<string> = new Set([
  "laravel_session",
  "logiflow-session",
  "logiflow_session",
]);

/** Top-level path segments that require a valid session. */
const PROTECTED_SEGMENTS: ReadonlySet<string> = new Set([
  "dashboard",
  "dispatches",
  "employees",
  "drivers",
  "vehicles",
  "warehouses",
  "orders",
  "driver",
]);

/** Slug character set — only allow lower-case alphanumerics and single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Returns true when the request carries at least one recognized stateful session cookie.
 */
function hasSessionCookie(request: NextRequest): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  let found = false;
  SESSION_COOKIE_NAMES.forEach((name) => {
    const pattern = new RegExp(`(?:^|;\\s*)${name}=`);
    if (pattern.test(cookieHeader)) {
      found = true;
    }
  });
  return found;
}

/**
 * Sanitizes a raw tenant candidate into a safe, deterministic slug.
 *
 * Fail-closed semantics: if the candidate is missing, is the string "null" or
 * "undefined", fails the slug charset, or collapses to empty after trimming,
 * it is rejected and `null` is returned. This guarantees the redirect target
 * can never be a broken "/null/login" or "/undefined/login" string.
 */
function sanitizeTenant(candidate: string | null | undefined): string | null {
  if (!candidate) return null;

  const raw = String(candidate).trim();
  if (raw.length === 0) return null;
  if (raw === "null" || raw === "undefined") return null;
  if (raw.length > 64) return null;
  if (!SLUG_PATTERN.test(raw)) return null;

  return raw;
}

/**
 * Determines whether a pathname targets a protected workspace route and, if so,
 * returns the tenant slug guarding it (from either the path or the host).
 */
function protectedRouteTenant(request: NextRequest, fallbackTenant: string | null): string | null {
  const pathname = request.nextUrl.pathname;
  const segments = pathname.split("/").filter(Boolean);

  // Shape: /<tenant>/dashboard/... or /<tenant>/employees/...
  if (segments.length >= 2 && PROTECTED_SEGMENTS.has(segments[1])) {
    // The tenant is always sanitized before use downstream; only a valid slug
    // proceeds. Invalid/ghost path segments fail closed.
    return sanitizeTenant(segments[0]);
  }

  // Shape (root-host access): /dashboard/... or /employees/... — gate by the
  // host-derived tenant if one exists.
  if (segments.length >= 1 && PROTECTED_SEGMENTS.has(segments[0])) {
    return sanitizeTenant(fallbackTenant);
  }

  return null;
}

/**
 * Resolves the tenant slug from a raw `Host` header.
 */
function resolveTenantSlug(host: string): string | null {
  if (ROOT_HOSTS.has(host)) return null;

  const hostname = host.split(":")[0]; // strip port, if present
  const labels = hostname.split(".");

  const isLocalTenantHost = labels.length === 2 && labels[1] === "localhost";
  const isProdTenantHost = labels.length >= 3;

  if (!isLocalTenantHost && isProdTenantHost === false) return null;

  const candidate = labels[0];
  if (!candidate || RESERVED_SUBDOMAINS.has(candidate)) return null;

  return sanitizeTenant(candidate);
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const tenant = resolveTenantSlug(host);
  const url = request.nextUrl.clone();

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1 SECURITY PERIMETER — Session guard for protected workspace paths.
  // ─────────────────────────────────────────────────────────────────────────
  const protectedTenant = protectedRouteTenant(request, tenant);

  if (protectedTenant === null && isProtectedPath(request)) {
    // A protected path was reached but no valid tenant could be resolved
    // (fail-closed). Never render the shell — bounce to the platform root so
    // the routing tree can re-resolve a clean tenant, and clear any stale query.
    const loginUrl = url.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (protectedTenant && !hasSessionCookie(request)) {
    const loginUrl = url.clone();

    // FIXED: Check if the incoming host already carries the subdomain prefix.
    // If it does, bounce to a clean "/login" to prevent path segment duplication loops.
    const currentHost = request.headers.get("host") ?? "";
    const carriesSubdomain = currentHost.startsWith(`${protectedTenant}.`);

    loginUrl.pathname = carriesSubdomain ? "/login" : `/${protectedTenant}/login`;
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

  // Internally namespace under the `[tenant]` dynamic segment
  url.pathname = `/${tenant}${url.pathname}`;

  const response = NextResponse.rewrite(url);
  response.headers.set("x-tenant-slug", tenant);
  return response;
}

/**
 * Returns true when the first non-empty path segment matches a protected
 * workspace segment (either tenant-scoped or root-host shape).
 */
function isProtectedPath(request: NextRequest): boolean {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  // Protected at root-host shape: /dashboard, /dispatches, /employees
  if (PROTECTED_SEGMENTS.has(segments[0])) return true;

  // Protected at tenant-scoped shape: /<tenant>/dashboard, etc.
  if (segments.length >= 2 && PROTECTED_SEGMENTS.has(segments[1])) return true;

  return false;
}

export const config = {
  matcher: [
    /*
     * Run on every route except Next.js internals and common static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};

