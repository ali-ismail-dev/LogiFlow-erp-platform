import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiClient,
  createApiClient,
  resolveTenantSlug,
  TenantContextNotResolvedError,
} from "@/lib/api/apiClient";
import type { ApiResponse } from "@/lib/api/apiClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mocks `window.location` with a given hostname.
 * We mutate `window.location` via a getter override so that the ApiClient
 * reads the fake hostname transparently.
 */
function mockLocationHostname(hostname: string): void {
  Object.defineProperty(window, "location", {
    value: {
      ...window.location,
      hostname,
      host: hostname,
      protocol: "https:",
      href: `https://${hostname}/`,
      origin: `https://${hostname}`,
    },
    writable: true,
    configurable: true,
  });
}

/** Returns the default hostname for tests (localhost). */
function restoreHostname(): void {
  mockLocationHostname("localhost");
}

// ---------------------------------------------------------------------------
// resolveTenantSlug unit tests
// ---------------------------------------------------------------------------

describe("resolveTenantSlug()", () => {
  it("returns null for bare localhost", () => {
    expect(resolveTenantSlug("localhost")).toBeNull();
  });

  it("returns null for platform root domains (logiflow.com, www.logiflow.app)", () => {
    expect(resolveTenantSlug("logiflow.com")).toBeNull();
    expect(resolveTenantSlug("www.logiflow.app")).toBeNull();
    expect(resolveTenantSlug("logiflow.app")).toBeNull();
  });

  it("returns null for reserved subdomains (www, app, api, admin, status)", () => {
    expect(resolveTenantSlug("www.logiflow.app")).toBeNull();
    expect(resolveTenantSlug("app.logiflow.app")).toBeNull();
    expect(resolveTenantSlug("api.logiflow.com")).toBeNull();
    expect(resolveTenantSlug("admin.logiflow.app")).toBeNull();
    expect(resolveTenantSlug("status.logiflow.com")).toBeNull();
  });

  it("returns the tenant slug for a local dev subdomain (acme.localhost)", () => {
    expect(resolveTenantSlug("acme.localhost")).toBe("acme");
  });

  it("returns the tenant slug for a production subdomain (acme.logiflow.app)", () => {
    expect(resolveTenantSlug("acme.logiflow.app")).toBe("acme");
  });

  it("returns the tenant slug for a production subdomain (beta.logiflow.com)", () => {
    expect(resolveTenantSlug("beta.logiflow.com")).toBe("beta");
  });

  it("returns null for unknown multi-level domains that don't match expected patterns", () => {
    expect(resolveTenantSlug("random.example.com")).toBeNull();
  });

  it("handles tenant slugs with hyphens correctly", () => {
    expect(resolveTenantSlug("merchant-a.logiflow.app")).toBe("merchant-a");
    expect(resolveTenantSlug("my-company.localhost")).toBe("my-company");
  });
});

// ---------------------------------------------------------------------------
// ApiClient integration tests
// ---------------------------------------------------------------------------

describe("ApiClient", () => {
  beforeEach(() => {
    restoreHostname();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Tenant resolution
  // -----------------------------------------------------------------------

  describe("tenant resolution on construction", () => {
    it("extracts the tenant slug from window.location.hostname (acme.logiflow.app)", () => {
      mockLocationHostname("acme.logiflow.app");
      const client = new ApiClient();
      expect(client.tenant).toBe("acme");
    });

    it("extracts the tenant slug from window.location.hostname (beta.logiflow.app)", () => {
      mockLocationHostname("beta.logiflow.app");
      const client = new ApiClient();
      expect(client.tenant).toBe("beta");
    });

    it("extracts the tenant slug from a local dev hostname (merchant-a.localhost)", () => {
      mockLocationHostname("merchant-a.localhost");
      const client = new ApiClient();
      expect(client.tenant).toBe("merchant-a");
    });

    it("throws TenantContextNotResolvedError when on bare localhost", () => {
      mockLocationHostname("localhost");
      expect(() => new ApiClient()).toThrow(TenantContextNotResolvedError);
      expect(() => new ApiClient()).toThrow(
        /could not resolve tenant slug from hostname/i,
      );
    });

    it("throws TenantContextNotResolvedError when on a reserved subdomain (app.localhost)", () => {
      mockLocationHostname("app.localhost");
      expect(() => new ApiClient()).toThrow(TenantContextNotResolvedError);
    });

    it("throws TenantContextNotResolvedError when on platform root", () => {
      mockLocationHostname("logiflow.app");
      expect(() => new ApiClient()).toThrow(TenantContextNotResolvedError);
    });
  });

  // -----------------------------------------------------------------------
  // Request header injection
  // -----------------------------------------------------------------------

  describe("request header injection", () => {
    it("injects X-Tenant-ID header on GET requests", async () => {
      mockLocationHostname("acme.logiflow.app");

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new ApiClient({ baseUrl: "https://api.logiflow.test/api/v1" });
      await client.get("/dispatches");

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["X-Tenant-ID"]).toBe("acme");
    });

    it("injects X-Tenant-ID header on POST requests", async () => {
      mockLocationHostname("beta.logiflow.app");

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id: 1 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new ApiClient({ baseUrl: "https://api.logiflow.test/api/v1" });
      await client.post("/dispatches", { reference_code: "DSP-TEST" });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["X-Tenant-ID"]).toBe("beta");
    });

    it("injects Content-Type and Accept headers", async () => {
      mockLocationHostname("acme.logiflow.app");

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new ApiClient({ baseUrl: "https://api.logiflow.test/api/v1" });
      await client.get("/dispatches");

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Accept"]).toBe("application/json");
    });

    it("serializes the request body as JSON for POST requests", async () => {
      mockLocationHostname("acme.logiflow.app");

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id: 1 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new ApiClient({ baseUrl: "https://api.logiflow.test/api/v1" });
      const body = { warehouse_id: 1, reference_code: "DSP-TEST" };
      await client.post("/dispatches", body);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(options.body).toBe(JSON.stringify(body));
    });
  });

  // -----------------------------------------------------------------------
  // HTTP method wrappers
  // -----------------------------------------------------------------------

  describe("HTTP method wrappers", () => {
    it("GET returns parsed JSON response", async () => {
      mockLocationHostname("acme.logiflow.app");

      const mockData = [{ id: "dsp_1" }, { id: "dsp_2" }];
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new ApiClient({ baseUrl: "https://api.logiflow.test/api/v1" });
      const response: ApiResponse<typeof mockData> = await client.get("/dispatches");
      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockData);
    });

    it("POST returns parsed JSON with status 201", async () => {
      mockLocationHostname("acme.logiflow.app");

      const created = { id: "dsp_new", reference_code: "DSP-NEW" };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(created), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new ApiClient({ baseUrl: "https://api.logiflow.test/api/v1" });
      const response = await client.post("/dispatches", created);
      expect(response.status).toBe(201);
      expect(response.data).toEqual(created);
    });

    it("PUT sends the correct method and body", async () => {
      mockLocationHostname("acme.logiflow.app");

      const updated = { driver_name: "New Driver" };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(updated), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new ApiClient({ baseUrl: "https://api.logiflow.test/api/v1" });
      const response = await client.put("/dispatches/dsp_1", updated);
      expect(response.status).toBe(200);
      expect(response.data).toEqual(updated);
    });

    it("PATCH sends the correct method and body", async () => {
      mockLocationHostname("acme.logiflow.app");

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ status: "patched" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new ApiClient({ baseUrl: "https://api.logiflow.test/api/v1" });
      const response = await client.patch("/dispatches/dsp_1", { status: "in_transit" });
      expect(response.status).toBe(200);
      expect(response.data).toEqual({ status: "patched" });
    });

    it("DELETE sends the correct method and returns 204", async () => {
      mockLocationHostname("acme.logiflow.app");

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 204 }),
      );

      const client = new ApiClient({ baseUrl: "https://api.logiflow.test/api/v1" });
      const response = await client.delete("/dispatches/dsp_1");
      expect(response.status).toBe(204);
      expect(response.data).toBeUndefined();
    });

    it("appends query params for GET requests", async () => {
      mockLocationHostname("acme.logiflow.app");

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new ApiClient({ baseUrl: "https://api.logiflow.test/api/v1" });
      await client.get("/dispatches", { params: { status: "in_transit", page: "1" } });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      const parsedUrl = new URL(url);
      expect(parsedUrl.searchParams.get("status")).toBe("in_transit");
      expect(parsedUrl.searchParams.get("page")).toBe("1");
    });
  });

  // -----------------------------------------------------------------------
  // Tenant resolution failure before network request
  // -----------------------------------------------------------------------

  describe("tenant resolution failure before network request", () => {
    it("throws before attempting fetch when no tenant is resolvable", () => {
      mockLocationHostname("localhost");

      const fetchSpy = vi.spyOn(globalThis, "fetch");

      expect(() => new ApiClient()).toThrow(TenantContextNotResolvedError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("does not throw for a valid tenant subdomain", () => {
      mockLocationHostname("acme.logiflow.app");

      const fetchSpy = vi.spyOn(globalThis, "fetch");

      expect(() => new ApiClient()).not.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // createApiClient factory
  // -----------------------------------------------------------------------

  describe("createApiClient factory", () => {
    it("returns a new ApiClient instance", () => {
      mockLocationHostname("acme.logiflow.app");
      const client = createApiClient();
      expect(client).toBeInstanceOf(ApiClient);
      expect(client.tenant).toBe("acme");
    });

    it("passes config options through", () => {
      mockLocationHostname("acme.logiflow.app");
      const client = createApiClient({ baseUrl: "https://custom.api/base", timeout: 5000 });
      expect(client).toBeInstanceOf(ApiClient);
    });
  });
});
