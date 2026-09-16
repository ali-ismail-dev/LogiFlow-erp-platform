// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CapacityGauge } from "@/components/dispatch/CapacityGauge";

describe("CapacityGauge", () => {
  it("renders the current percentage from selected order weight", () => {
    render(<CapacityGauge currentWeightKg={850} maxCapacityKg={1200} />);
    expect(screen.getByText("850 kg / 1,200 kg")).toBeTruthy();
    expect(screen.getByText("71%")).toBeTruthy();
  });

  it("shows an overweight warning when selected orders exceed capacity", () => {
    render(<CapacityGauge currentWeightKg={1350} maxCapacityKg={1200} />);
    expect(screen.getByRole("alert").textContent).toContain("Exceeds vehicle capacity by 150 kg");
    expect(screen.getByText("113%")).toBeTruthy();
  });
});
