# RSC Service Token Prerequisite

The Next.js server components authenticate backend reads with
`LOGIFLOW_RSC_SERVICE_TOKEN`. This must be a Laravel Sanctum personal access
token issued to a dedicated, non-human RSC service user.

## Principal model

One global RSC service principal exists with `tenant_id = null` and
`role = rsc_service`. The reserved email
`rsc-service@internal.logiflow.invalid` is used for that single account, and the
backend trusts the RSC service principal to identify the active tenant via the
`X-Tenant-ID` header.

A single Sanctum token is issued to the global principal with
`php artisan logiflow:rsc-token issue --global`. The frontend stores that value
in `LOGIFLOW_RSC_SERVICE_TOKEN`. On every request, the RSC sends
`X-Tenant-ID` to specify which tenant it is rendering for. The backend trusts
that service principal to correctly identify the tenant, because the RSC derives
it from the request's subdomain and rejects rendering when they disagree.

Tenant isolation for database queries is enforced by `TenantScope` using
whatever tenant `X-Tenant-ID` resolves to. This is the standard
backend-for-frontend service-account pattern for a single shared frontend.

Security trade-off: a leaked global token grants read access to all tenants.
Mitigations include keeping the token on the frontend server only, running the
frontend on an internal Docker network, rotating the token with a single command,
and logging all token usage.

## Token requirements

- Issue the token through Sanctum to the dedicated RSC service user.
- Grant only the read ability needed by the RSC endpoints: orders, drivers,
  warehouses, vehicles, dispatches, users, and `tenants/current`.
- Do not grant write, administrative, impersonation, or wildcard abilities.
- Rotate the token on a defined schedule, at least every 90 days, and revoke
  the previous token after the deployment has adopted its replacement.
- Inject the value into the frontend runtime through a secret manager or
  CI/CD secret. Never commit the token to git, place it in a `NEXT_PUBLIC_*`
  variable, or expose it to browser code.

## Operational Caveats

### Docker and the root `.env`

`LOGIFLOW_RSC_SERVICE_TOKEN` must be present in the root `.env` file for
`docker compose up` to inject it into the frontend container. If it is
missing, Compose substitutes an empty string. The RSC then throws
`MissingLogiflowServiceTokenError` at request time, and the dashboard returns
HTTP 500. This failure is intentional and loud by design.

### `LOG_CHANNEL` and the `issue` subcommand

`php artisan logiflow:rsc-token issue` writes the plaintext token to stdout,
and the command's audit line is written via `Log::info()`. If `LOG_CHANNEL` is
ever changed to `stdout`, the audit line will be interleaved with the token in
piped output such as
`TOKEN=$(php artisan logiflow:rsc-token issue ...)`. Keep `LOG_CHANNEL` on a
file or stderr destination.