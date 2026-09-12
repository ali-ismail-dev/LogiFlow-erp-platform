# RSC Service Token Prerequisite

The Next.js server components authenticate backend reads with
`LOGIFLOW_RSC_SERVICE_TOKEN`. This must be a Laravel Sanctum personal access
token issued to a dedicated, non-human RSC service user.

## Principal model

One RSC service principal exists per tenant. Each principal has `tenant_id` set
to that tenant's id and `role = rsc_service`. The reserved email
`rsc-service@internal.logiflow.invalid` is used for every principal and is
uniquely constrained per tenant by `tenant_id + email`.

Tokens are issued per tenant with
`php artisan logiflow:rsc-token issue --tenant=<slug>`. A token issued for one
tenant is not valid for another tenant. Sanctum's tenant-scoped user lookup
returns 401 when the token's owner is not in the requested tenant's scope. This
is intentional and is the primary isolation guarantee.

Consequently, a single frontend instance that serves multiple tenants must
supply a per-tenant token. The current implementation supports one token per
frontend deployment. A future change, such as a token map keyed by tenant slug,
is required before one frontend can serve more than one tenant from a single
token environment variable. This is a known limitation, not a defect.

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