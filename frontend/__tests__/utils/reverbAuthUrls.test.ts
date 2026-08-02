import { describe, expect, it } from "vitest";
import { getBroadcastingAuthUrl, getSanctumCsrfCookieUrl } from "@/lib/reverb-auth";

describe("reverb auth url helpers", () => {
  it("strips the API prefix for broadcasting auth requests", () => {
    expect(getBroadcastingAuthUrl("http://localhost:8000/api/v1")).toBe("http://localhost:8000/broadcasting/auth");
    expect(getBroadcastingAuthUrl("http://localhost:8000")).toBe("http://localhost:8000/broadcasting/auth");
  });

  it("strips the API prefix for sanctum csrf cookie requests", () => {
    expect(getSanctumCsrfCookieUrl("http://localhost:8000/api/v1")).toBe("http://localhost:8000/sanctum/csrf-cookie");
    expect(getSanctumCsrfCookieUrl("http://localhost:8000")).toBe("http://localhost:8000/sanctum/csrf-cookie");
  });
});
