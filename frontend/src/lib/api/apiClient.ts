// -----------------------------------------------------------------------------
// Tenant-aware API client for communicating with the Laravel v13 backend.
// Automatically resolves the tenant slug from the browser's current location
// and injects it as the X-Tenant-ID header on every outgoing request.
// -----------------------------------------------------------------------------

export class TenantContextNotResolvedError extends Error {
  constructor(message?: string) {
    super(message ?? "Tenant context could not be resolved from the current URL.");
    this.name = "TenantContextNotResolvedError";
  }
}

/**
 * Resolves the tenant slug from `window.location.hostname`.
 *
 * Supports production (acme.logiflow.app → "acme") and local development
 * (acme.localhost → "acme") hostname shapes. Returns `null` when the
 * hostname is the platform root or reserved.
 */
export function resolveTenantSlug(hostname: string): string | null {
  const ROOT_HOSTS = new Set(["localhost", "logiflow.com", "www.logiflow.com", "logiflow.app", "www.logiflow.app"]);
  const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "status"]);

  if (ROOT_HOSTS.has(hostname)) return null;

  const labels = hostname.split(".");

  // Local dev: <tenant>.localhost
  const isLocalTenantHost = labels.length === 2 && labels[1] === "localhost";
  // Production: <tenant>.logiflow.app or <tenant>.logiflow.com
  const isProdTenantHost =
    (labels.length === 3 && labels[1] === "logiflow") ||
    (labels.length === 3 && labels[1] === "localhost" && labels[2] === "app");

  if (!isLocalTenantHost && !isProdTenantHost) return null;

  const candidate = labels[0];
  if (!candidate || RESERVED_SUBDOMAINS.has(candidate)) return null;

  return candidate;
}

/**
 * API client configuration.
 */
export interface ApiClientConfig {
  /** Override base URL (default: derived from window.location). */
  baseUrl?: string;
  /** Timeout in milliseconds (default: 15000). */
  timeout?: number;
}

/**
 * Options for a single API request.
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

/**
 * Response envelope returned by every API method.
 */
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * Reads the `XSRF-TOKEN` cookie set by Laravel's `/sanctum/csrf-cookie` endpoint
 * and returns it URL-decoded (Laravel writes the CSRF token as an encrypted,
 * URL-encoded cookie value). The decoded value must be sent back as the
 * `X-XSRF-TOKEN` header so Sanctum's `ValidateCsrfToken` middleware accepts the
 * stateful request.
 */
function readXsrfToken(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Tenant-aware fetch wrapper.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly tenantSlug: string;

  constructor(config?: ApiClientConfig) {
    const slug = resolveTenantSlug(window.location.hostname);
    if (!slug) {
      throw new TenantContextNotResolvedError(
        `Could not resolve tenant slug from hostname "${window.location.hostname}". ` +
          "Ensure you are accessing the application via a tenant subdomain (e.g., acme.logiflow.app).",
      );
    }
    this.tenantSlug = slug;

    this.baseUrl = config?.baseUrl ?? `${window.location.protocol}//${window.location.host}/api/v1`;
    this.timeout = config?.timeout ?? 15000;
  }

  /** The resolved tenant slug for this client instance. */
  get tenant(): string {
    return this.tenantSlug;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Tenant-ID": this.tenantSlug,
      ...options?.headers,
    };

    // Stateful Sanctum handshake: Laravel's ValidateCsrfToken requires the
    // XSRF token (set by /sanctum/csrf-cookie) to be returned as the
    // X-XSRF-TOKEN header on mutating requests, or it rejects with a 419.
    const xsrfToken = readXsrfToken();
    if (xsrfToken) {
      headers["X-XSRF-TOKEN"] = xsrfToken;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        credentials: "include", // FIXED: Forces browser fetch layers to attach Sanctum session cookies natively
      });

      const responseData: T = response.status !== 204 ? await response.json() : (undefined as T);

      return {
        data: responseData,
        status: response.status,
        headers: response.headers,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body, options);
  }

  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", path, body, options);
  }

  async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", path, body, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path, undefined, options);
  }
}

/** Singleton-style factory; creates a new client per invocation. */
export function createApiClient(config?: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
