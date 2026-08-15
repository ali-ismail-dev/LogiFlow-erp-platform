import { describe, expect, it } from "vitest";
import { formatDepartedTime } from "@/components/dashboard/dispatch-board";

describe("formatDepartedTime", () => {
  it("formats a UTC server timestamp using the browser-local time zone", () => {
    const dateString = "2025-01-15T18:20:00Z";
    const expected = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateString));

    expect(formatDepartedTime(dateString)).toBe(expected);
  });

  it("returns a safe fallback for missing timestamps", () => {
    expect(formatDepartedTime(null)).toBe("-");
    expect(formatDepartedTime(undefined)).toBe("-");
  });
});
