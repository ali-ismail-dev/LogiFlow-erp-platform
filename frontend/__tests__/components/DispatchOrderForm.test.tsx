import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DispatchOrderForm } from "@/components/dispatch/DispatchOrderForm";
import type { DispatchFormPayload } from "@/components/dispatch/DispatchOrderForm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  const view = render(<DispatchOrderForm onSubmit={onSubmit} />);
  return { onSubmit, user, ...view };
}

async function fillStop(
  user: ReturnType<typeof userEvent.setup>,
  stopIndex: number,
  overrides?: {
    orderId?: string;
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  },
) {
  const stopGroup = screen.getByRole("group", { name: new RegExp(`stop ${stopIndex}`, "i") });

  const orderIdInput = within(stopGroup).getByRole("spinbutton", { name: /order id/i });
  await user.clear(orderIdInput);
  await user.type(orderIdInput, overrides?.orderId ?? "5501");

  const line1Input = within(stopGroup).getByRole("textbox", { name: /address line 1/i });
  await user.clear(line1Input);
  await user.type(line1Input, overrides?.line1 ?? "412 Harrow St");

  const cityInput = within(stopGroup).getByRole("textbox", { name: /city/i });
  await user.clear(cityInput);
  await user.type(cityInput, overrides?.city ?? "Oakland");

  const stateInput = within(stopGroup).getByRole("textbox", { name: /state/i });
  await user.clear(stateInput);
  await user.type(stateInput, overrides?.state ?? "CA");

  const postalInput = within(stopGroup).getByRole("textbox", { name: /postal code/i });
  await user.clear(postalInput);
  await user.type(postalInput, overrides?.postalCode ?? "94612");

  const countryInput = within(stopGroup).getByRole("textbox", { name: /country/i });
  await user.clear(countryInput);
  await user.type(countryInput, overrides?.country ?? "US");
}

async function fillFormFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("spinbutton", { name: /warehouse id/i }), "42");
  await user.type(screen.getByRole("textbox", { name: /reference code/i }), "DSP-9000");
  await user.type(screen.getByRole("textbox", { name: /driver name/i }), "Jane Doe");
  await user.type(screen.getByRole("textbox", { name: /vehicle identifier/i }), "VAN-007");

  const scheduledAt = screen.getByLabelText(/scheduled at/i);
  await user.clear(scheduledAt);
  await user.type(scheduledAt, "2026-07-28T10:00");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DispatchOrderForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders all five top-level input fields", () => {
      setup();

      expect(screen.getByRole("spinbutton", { name: /warehouse id/i })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /reference code/i })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /driver name/i })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /vehicle identifier/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/scheduled at/i)).toBeInTheDocument();
    });

    it("renders the Stops fieldset with one initial stop", () => {
      setup();

      expect(screen.getByRole("group", { name: /stops/i })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: /stop 1/i })).toBeInTheDocument();
    });

    it("renders the Add Stop and Remove Stop buttons", () => {
      setup();

      expect(screen.getByRole("button", { name: /add stop/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /remove stop 1/i })).toBeInTheDocument();
    });

    it("renders the submit button", () => {
      setup();
      expect(screen.getByRole("button", { name: /create dispatch/i })).toBeInTheDocument();
    });
  });

  describe("stops interaction", () => {
    it("allows adding multiple stops via Add Stop button", async () => {
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: /add stop/i }));
      expect(screen.getByRole("group", { name: /stop 2/i })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /add stop/i }));
      expect(screen.getByRole("group", { name: /stop 3/i })).toBeInTheDocument();
    });

    it("removes a stop when Remove Stop is clicked", async () => {
      const { user } = setup();

      expect(screen.getByRole("group", { name: /stop 1/i })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /remove stop 1/i }));

      expect(screen.queryByRole("group", { name: /stop 1/i })).not.toBeInTheDocument();
    });

    it("allows removing a specific stop when multiple are present and safely shifts array values", async () => {
      const { user } = setup();

      // Hydrate Stop 1 uniquely
      await fillStop(user, 1, { orderId: "1111", line1: "111 First St" });
      
      // Spawn and hydrate Stop 2 uniquely
      await user.click(screen.getByRole("button", { name: /add stop/i }));
      await fillStop(user, 2, { orderId: "2222", line1: "222 Second St" });

      // Spawn and hydrate Stop 3 uniquely
      await user.click(screen.getByRole("button", { name: /add stop/i }));
      await fillStop(user, 3, { orderId: "3333", line1: "333 Third St" });

      // Action: Strip out the middle segment slice (Stop 2)
      await user.click(screen.getByRole("button", { name: /remove stop 2/i }));

      // FIXED: Senior Assertions explicitly confirm array value re-indexing parameters hold
      const remainingStop2Group = screen.getByRole("group", { name: /stop 2/i });
      const orderIdInput = within(remainingStop2Group).getByRole("spinbutton", { name: /order id/i });
      
      // Proves old Stop 3 content dropped into slot 2 position safely
      expect(orderIdInput).toHaveValue(3333);
      expect(screen.queryByRole("group", { name: /stop 3/i })).not.toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("shows an error when submitting with zero stops", async () => {
      const { user } = setup();

      await user.click(screen.getByRole("button", { name: /remove stop 1/i }));
      await user.click(screen.getByRole("button", { name: /create dispatch/i }));

      expect(screen.getByRole("alert")).toHaveTextContent("A dispatch requires at least one stop");
    });

    it("does NOT call onSubmit when validation fails", async () => {
      const { user, onSubmit } = setup();

      await user.click(screen.getByRole("button", { name: /remove stop 1/i }));
      await user.click(screen.getByRole("button", { name: /create dispatch/i }));

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("submission payload", () => {
    it("submits the correct payload structure matching DispatchFormPayload DTO", async () => {
      const { user, onSubmit } = setup();

      await fillFormFields(user);

      await fillStop(user, 1, {
        orderId: "5501",
        line1: "412 Harrow St",
        city: "Oakland",
        state: "CA",
        postalCode: "94612",
        country: "US",
      });

      await user.click(screen.getByRole("button", { name: /add stop/i }));
      await fillStop(user, 2, {
        orderId: "9812",
        line1: "88 Marina Blvd",
        city: "Berkeley",
        state: "CA",
        postalCode: "94704",
        country: "US",
      });

      await user.click(screen.getByRole("button", { name: /create dispatch/i }));

      expect(onSubmit).toHaveBeenCalledTimes(1);

      const payload = onSubmit.mock.calls[0][0] as DispatchFormPayload;

      expect(payload.warehouse_id).toBe(42);
      expect(payload.reference_code).toBe("DSP-9000");
      expect(payload.driver_name).toBe("Jane Doe");
      expect(payload.vehicle_identifier).toBe("VAN-007");
      expect(payload.scheduled_at).toBeTruthy();
      expect(typeof payload.scheduled_at).toBe("string");

      expect(payload.stops).toHaveLength(2);

      expect(payload.stops[0].order_id).toBe(5501);
      expect(payload.stops[0].sequence).toBe(1);
      expect(payload.stops[0].destination_address.line1).toBe("412 Harrow St");
      expect(payload.stops[0].destination_address.city).toBe("Oakland");
      expect(payload.stops[0].destination_address.state).toBe("CA");
      expect(payload.stops[0].destination_address.postal_code).toBe("94612");
      expect(payload.stops[0].destination_address.country).toBe("US");

      expect(payload.stops[1].order_id).toBe(9812);
      expect(payload.stops[1].sequence).toBe(2);
      expect(payload.stops[1].destination_address.line1).toBe("88 Marina Blvd");
      expect(payload.stops[1].destination_address.city).toBe("Berkeley");
      expect(payload.stops[1].destination_address.state).toBe("CA");
      expect(payload.stops[1].destination_address.postal_code).toBe("94704");
      expect(payload.stops[1].destination_address.country).toBe("US");
    });
  });
});
