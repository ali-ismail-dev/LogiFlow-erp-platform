export function getAddressLine1(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return getAddressLine1(parsed);
      }
      if (typeof parsed === "string") {
        return getAddressLine1(parsed);
      }
    } catch {
      // Fall through to simple comma-delimited parsing below.
    }

    const [firstSegment] = trimmed.split(",");
    return firstSegment?.trim() || "";
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  const candidates = [
    record.line1,
    record.street,
    record.address_line1,
    record.addressLine1,
    record.address1,
    record.address_1,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }

  return "";
}

export function formatAddressValue(value: unknown, fallback = "Address pending"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const parts = [
      getAddressLine1(record),
      typeof record.line2 === "string" ? record.line2.trim() : "",
      typeof record.city === "string" ? record.city.trim() : "",
      typeof record.state === "string" ? record.state.trim() : "",
      typeof record.postal_code === "string" ? record.postal_code.trim() : "",
      typeof record.country === "string" ? record.country.trim() : "",
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(", ");
    }
  }

  return fallback;
}

export function formatWarehouseLocation(addressValue: unknown, cityValue?: string | null): string {
  const addressText = formatAddressValue(addressValue, "");
  const cityText = typeof cityValue === "string" ? cityValue.trim() : "";

  if (!addressText && !cityText) {
    return "Address pending";
  }

  const locationParts = [addressText, cityText].filter(Boolean);
  const deduped = locationParts.filter((part, index) => {
    if (!part) return false;
    return index === 0 || !locationParts.slice(0, index).some((previous) => previous === part);
  });

  return deduped.join(", ");
}
