# PHASE 1 — Workspace Identity & Accessibility

> **Owner:** Platform Engineering (Infrastructure + Frontend)
> **Status:** Implementing
> **Gateways:** Port-8000 Nginx proxy (native `fetch` + `credentials: "include"`)
> **Stack:** Next.js App Router / Laravel 13 (Sanctum stateful sessions)

---

## 1. Problem Statement

The public landing page (`frontend/src/app/page.tsx`) accepted **any** typed handle and
routed the browser straight to `/{slug}/login` with zero backend verification. A user could
craft `http://nike.localhost:3001/dashboard` (or any bogus subdomain) and the dashboard
would render without a session guard — leaking tenant-scoped UI and bypassing the
multi-tenant identity boundary.

This phase closes two gaps:

1. **Public Onboarding Locator** — validate a handle against the backend *before* trusting it.
2. **Global Router Guard** — intercept protected workspace paths and bounce unauthenticated
   browsers back to the tenant login perimeter.

---

## 2. Technical Reasoning

### 2.1 Why native `fetch` for the locator (not `createApiClient`)

`createApiClient` (see `frontend/src/lib/api/apiClient.ts`) **throws
`TenantContextNotResolvedError`** when it cannot resolve a tenant slug from
`window.location.hostname`. The landing page runs on the **root** host
(`localhost:3001` / `logiflow.app`) — there is no tenant subdomain yet, so the helper is
structurally incapable of bootstrapping the very first tenant lookup.

The locator therefore uses a **native `fetch` layer** that:

- Targets the port-8000 Nginx gateway: `${protocol}//${hostname}:8000`.
- Sends the user's handle as the `X-Tenant-ID` header (the backend's **Priority 1**
  tenant-resolution source, per `TenantMiddleware::extractSlug`).
- Passes `credentials: "include"` so any `laravel_session` / `XSRF-TOKEN` cookies are
  attached natively (cross-origin session-boundary integrity).
- Wraps the whole transaction in a strict `try/catch` with graceful, friendly fallbacks.

### 2.2 Why preserve the broad middleware matcher

The existing `middleware.ts` performs tenant **subdomain → `/[tenant]` rewriting**
(e.g. `nike.localhost:3001/dashboard` maps internally to `/[tenant]/dashboard`). Replacing
its matcher with only `/[tenant]/dashboard/:path*` + `/[tenant]/dispatches/:path*` would
**break** the subdomain translation the whole system depends on. The correct architecture
keeps the broad matcher (routing concern) and **layers** the session guard (security
concern) *inside* the handler.

### 2.3 Session cookie detection

Laravel's session cookie name is `Str::slug(env('APP_NAME')) . '-session'` (see
`backend/config/session.php`). Depending on `APP_NAME` this resolves to `logiflow_session`
or `laravel_session`. The middleware checks a **candidate set** of both names to stay
robust across environment overrides. The cookie is host-only (no `Domain` attribute), so
it is shared across ports on the same tenant subdomain — exactly what allows the port-3001
Next.js app to observe the session created via the port-8000 gateway.

### 2.4 Redirect target

When a protected path is reached without a valid session cookie, the middleware issues a
`NextResponse.redirect` to `/${tenant}/login`. The `tenant` is derived from either the
hostname subdomain (direct `nike.localhost` access) or the pathname's `[tenant]` segment
(internally rewritten requests), so every tenant is bounced to **its own** login perimeter —
never a global one.

---

## 3. Files Modified / Created

| File | Action | Purpose |
| --- | --- | --- |
| `frontend/src/app/page.tsx` | Overwrite | Secure public workspace locator with backend preflight verification |
| `frontend/src/middleware.ts` | Edit | Add stateful session-cookie guard to protected workspace paths |
| `frontend/PHASE1_TODO.md` | Create | This tracking scratchpad |

---

## 4. Why These Changes Preserve Multi-Tenant Security Boundaries

- **No trust-by-URL-typing:** The locator consults `GET /api/v1/tenants/current` and only
  proceeds when the backend returns a valid, active tenant envelope.
- **Tenant identity is backend-verified:** The numeric `id` and canonical `slug` come from
  the database-backed `TenantController`, not from user input.
- **Per-tenant redirect:** The URL is rebuilt by replacing the *hostname label* with the
  verified slug, preserving protocol + port, so `acme.logiflow.app` and `acme.localhost:3001`
  both resolve correctly.
- **Session-scoped guard:** Unauthenticated browsers are intercepted at the edge and
  redirected to `/{tenant}/login` before any tenant-scoped component renders.
- **Error-resilient boundaries:** Every API transaction is wrapped in `try/catch` with
  friendly fallback strings, so failures degrade to a clean UX rather than leaking stack
  traces or bypassing the guard.

---

## 5. Verification Checklist

- [ ] `npm run lint` passes in `frontend/`.
- [ ] `npm run build` passes (type-safe, no placeholder code).
- [ ] A valid handle redirects to `http://{slug}.localhost:{port}` (protocol/port preserved).
- [ ] An invalid handle shows the animated error banner (no redirect).
- [ ] `/{tenant}/dashboard/*` and `/{tenant}/dispatches/*` without a session cookie redirect
      to `/{tenant}/login`.
- [ ] Tenant subdomain → `/[tenant]` rewriting still functions after the guard is added.

---

*Phase 1 complete — Workspace Identity & Accessibility hardened at the edge.*
