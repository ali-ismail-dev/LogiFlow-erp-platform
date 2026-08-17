import { describe, expect, it } from "vitest";
import { formatAddressValue, formatWarehouseLocation, getAddressLine1 } from "@/lib/address";

describe("address formatting helpers", () => {
  it("stringifies nested address objects into a readable address line", () => {
    expect(
      formatAddressValue({
        street: "7400 Logistics Avenue",
        city: "Dallas",
        state: "TX",
      }),
    ).toBe("7400 Logistics Avenue, Dallas, TX");
  });

  it("combines the address and city without duplicating a city label", () => {
    expect(
      formatWarehouseLocation(
        { street: "7400 Logistics Avenue", city: "Dallas" },
        "Austin",
      ),
    ).toBe("7400 Logistics Avenue, Dallas, Austin");
  });

  it("handles nested object payloads exactly as returned by the backend", () => {
    expect(
      formatWarehouseLocation(
        { city: "Pittsburgh", street: "245 Harbor Avenue" },
        undefined,
      ),
    ).toBe("245 Harbor Avenue, Pittsburgh");
  });

  it("extracts the first address line from backend payloads regardless of the key name", () => {
    expect(getAddressLine1({ street: "245 Harbor Avenue", city: "Pittsburgh" })).toBe("245 Harbor Avenue");
    expect(getAddressLine1({ line1: "245 Harbor Avenue", city: "Pittsburgh" })).toBe("245 Harbor Avenue");
    expect(getAddressLine1({ address_line1: "245 Harbor Avenue" })).toBe("245 Harbor Avenue");
  });

  it("handles raw string and JSON-string address payloads", () => {
    expect(getAddressLine1("245 Harbor Avenue, Pittsburgh, PA")).toBe("245 Harbor Avenue");
    expect(getAddressLine1('{"street":"245 Harbor Avenue","city":"Pittsburgh","state":"PA"}')).toBe("245 Harbor Avenue");
  });
});
