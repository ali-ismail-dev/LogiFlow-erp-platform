import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base URL for the Acme tenant in the Playwright test environment. */
const ACME_BASE_URL = "https://acme.logiflow.test";

/** Base URL for the Beta tenant. */
const BETA_BASE_URL = "https://beta.logiflow.test";

/** Stubbed API response body for a successful dispatch creation. */
const MOCK_CREATE_DISPATCH_RESPONSE = {
  id: "dsp_e2e_001",
  reference_code: "DSP-E2E-001",
  status: "pending",
  driver_name: "E2E Test Driver",
  vehicle_identifier: "VAN-E2E",
  departed_at: null,
  warehouse: {
    id: 1,
    name: "E2E Test Warehouse",
    code: "E2E-01",
    timezone: "America/Los_Angeles",
    latitude: 37.7749,
    longitude: -122.4194,
  },
  stops: [
    {
      id: "stp_e2e_001",
      sequence: 1,
      status: "pending",
      eta: "2026-07-28T12:00:00Z",
      destination_address: {
        line1: "123 E2E Test Ave",
        city: "TestCity",
        state: "TC",
        postal_code: "12345",
        country: "US",
      },
      order: {
        id: 1,
        order_number: "ORD-E2E-001",
        customer_name: "E2E Customer",
        item_count: 5,
        weight_kg: 25.0,
        requires_signature: true,
      },
    },
    {
      id: "stp_e2e_002",
      sequence: 2,
      status: "pending",
      eta: "2026-07-28T14:00:00Z",
      destination_address: {
        line1: "456 E2E Test Blvd",
        city: "TestCity",
        state: "TC",
        postal_code: "12346",
        country: "US",
      },
      order: {
        id: 2,
        order_number: "ORD-E2E-002",
        customer_name: "E2E Customer 2",
        item_count: 3,
        weight_kg: 12.0,
        requires_signature: false,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seeds a mock auth session for the given tenant.
 *
 * In a real environment this would set a cookie, token, or localStorage
 * entry that satisfies the auth guard so the UI flows through to the
 * form page without a real login redirect.
 */
async function seedAuthSession(page: Page): Promise<void> {
  await page.goto(ACME_BASE_URL);

  // Mock the auth endpoint so the app considers the user authenticated.
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        name: "E2E Admin",
        email: "admin@e2e.logiflow.test",
        tenant_slug: "acme",
      }),
    });
  });

  // Simulate a session cookie that the middleware would check.
  await page.evaluate(() => {
    document.cookie = "session_token=e2e_test_session; path=/; domain=.logiflow.test";
    // Store auth token in localStorage as well for client-side checks.
    localStorage.setItem("auth_token", "e2e_test_session_token");
  });
}

/**
 * Attempts to navigate to the dispatch creation page.
 */
async function navigateToNewDispatch(page: Page): Promise<void> {
  await page.goto(`${ACME_BASE_URL}/dispatches/new`);
  await page.waitForLoadState("networkidle");
}

/**
 * Fills out the dispatch form with two stops.
 *
 * Assumes the form matches the DispatchOrderForm component structure:
 * - Inputs identified by accessible labels.
 * - "Add Stop" button to add the second stop.
 * - Stop fields are rendered inside role="group" groups.
 */
async function fillDispatchForm(page: Page): Promise<void> {
  // --- Top-level fields ---
  await page.getByRole("spinbutton", { name: /warehouse id/i }).fill("1");
  await page.getByRole("textbox", { name: /reference code/i }).fill("DSP-E2E-001");
  await page.getByRole("textbox", { name: /driver name/i }).fill("E2E Test Driver");
  await page.getByRole("textbox", { name: /vehicle identifier/i }).fill("VAN-E2E");

  // Scheduled at (datetime-local)
  const scheduledAt = page.getByLabel(/scheduled at/i);
  await scheduledAt.fill("2026-07-28T10:00");

  // --- Stop 1 (already present) ---
  const stop1 = page.getByRole("group", { name: /stop 1/i });
  await stop1.getByRole("spinbutton", { name: /order id/i }).fill("5501");
  await stop1.getByRole("textbox", { name: /address line 1/i }).fill("412 Harrow St");
  await stop1.getByRole("textbox", { name: /city/i }).fill("Oakland");
  await stop1.getByRole("textbox", { name: /state/i }).fill("CA");
  await stop1.getByRole("textbox", { name: /postal code/i }).fill("94612");
  await stop1.getByRole("textbox", { name: /country/i }).fill("US");

  // --- Add Stop 2 ---
  await page.getByRole("button", { name: /add stop/i }).click();

  const stop2 = page.getByRole("group", { name: /stop 2/i });
  await stop2.getByRole("spinbutton", { name: /order id/i }).fill("9812");
  await stop2.getByRole("textbox", { name: /address line 1/i }).fill("88 Marina Blvd");
  await stop2.getByRole("textbox", { name: /city/i }).fill("Berkeley");
  await stop2.getByRole("textbox", { name: /state/i }).fill("CA");
  await stop2.getByRole("textbox", { name: /postal code/i }).fill("94704");
  await stop2.getByRole("textbox", { name: /country/i }).fill("US");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Dispatch creation workflow with tenant isolation", () => {
  // -------------------------------------------------------------------------
  // Successful dispatch creation (Acme tenant)
  // -------------------------------------------------------------------------

  test("Acme tenant: creates a dispatch successfully and sees success state", async ({
    page,
  }) => {
    await seedAuthSession(page);
    await navigateToNewDispatch(page);

    // Intercept the POST to /api/v1/dispatches and return a 201.
    let capturedRequestBody: unknown = null;
    await page.route("**/api/v1/dispatches", async (route) => {
      capturedRequestBody = route.request().postDataJSON();

      // Check the X-Tenant-ID header
      const tenantId = route.request().headers()["x-tenant-id"];
      expect(tenantId).toBe("acme");

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CREATE_DISPATCH_RESPONSE),
      });
    });

    // Fill the form
    await fillDispatchForm(page);

    // Submit
    await page.getByRole("button", { name: /create dispatch/i }).click();

    // Wait for the API call to complete
    await page.waitForResponse((response) => {
      return (
        response.url().includes("/api/v1/dispatches") &&
        response.status() === 201
      );
    });

    // Assert the request body matches expected shape
    expect(capturedRequestBody).toMatchObject({
      warehouse_id: 1,
      reference_code: "DSP-E2E-001",
      driver_name: "E2E Test Driver",
    });

    // Assert the UI shows a success indicator
    // The form's submit button should either be disabled or gone.
    const submitButton = page.getByRole("button", { name: /create dispatch/i });
    await expect(submitButton).toBeDisabled();

    // Check that the page shows success state by looking for the reference code
    await expect(
      page.getByText(MOCK_CREATE_DISPATCH_RESPONSE.reference_code),
    ).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Cross-tenant isolation: Beta tenant with Acme's session
  // -------------------------------------------------------------------------

  test("cross-tenant isolation: Beta tenant rejects Acme session with 403", async ({
    page,
  }) => {
    // First, log in on Acme
    await seedAuthSession(page);
    await navigateToNewDispatch(page);

    // Assert we got through on Acme
    await expect(
      page.getByRole("form", { name: /dispatch order form/i }),
    ).toBeVisible({ timeout: 5000 });

    // Now, using the same browser context (same cookies/storage),
    // navigate to Beta.
    await page.goto(`${BETA_BASE_URL}/dispatches/new`);
    await page.waitForLoadState("networkidle");

    // Intercept the auth check on Beta and return a 403 to simulate the
    // backend rejecting the cross-tenant session.
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          message:
            "Tenant mismatch: your session is tied to a different tenant context.",
        }),
      });
    });

    // Assert that the page forces a re-login or shows an error.
    // The app should either redirect to a login page or display a 403 error.
    // We check for a login form or an error message indicating tenant mismatch.
    const loginForm = page.getByRole("form", { name: /login/i });
    const errorMessage = page.getByText(/tenant mismatch/i);
    const forbiddenMessage = page.getByText(/403|forbidden/i);
    const reLoginPrompt = page.getByText(/log in|sign in|re-login/i);

    const isRejected =
      (await loginForm.isVisible().catch(() => false)) ||
      (await errorMessage.isVisible().catch(() => false)) ||
      (await forbiddenMessage.isVisible().catch(() => false)) ||
      (await reLoginPrompt.isVisible().catch(() => false));

    expect(isRejected).toBe(true);
  });
});
