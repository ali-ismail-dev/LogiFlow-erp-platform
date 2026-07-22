// src/types/logistics.ts
// -----------------------------------------------------------------------------
// Strict TypeScript contract mirroring the Laravel v13 backend DTO layer.
// Any drift here must be reconciled with `App\Http\Resources\*` on the backend
// before merging — this file is the single source of truth for the frontend.
// -----------------------------------------------------------------------------

/**
 * Lifecycle states for a Dispatch, mirrored 1:1 from the backend's
 * `DispatchStatus` PHP enum (App\Enums\DispatchStatus).
 */
export enum DispatchStatus {
  PENDING = "pending",
  IN_TRANSIT = "in_transit",
  DELAYED = "delayed",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

/**
 * Lifecycle states for an individual Stop within a Dispatch's route,
 * mirrored from `App\Enums\StopStatus`.
 */
export enum StopStatus {
  PENDING = "pending",
  EN_ROUTE = "en_route",
  ARRIVED = "arrived",
  COMPLETED = "completed",
  FAILED = "failed",
}

/** Originating warehouse / distribution node for a Dispatch. */
export interface Warehouse {
  id: string;
  name: string;
  code: string;
  timezone: string;
  latitude: number;
  longitude: number;
}

/**
 * Structured address payload mirroring the `destination_address` JSON column
 * on the `stops` table — kept nested rather than flattened so the UI can
 * render partial fields (city/state chips, map pins) independently.
 */
export interface DestinationAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
}

/** Order payload nested inside a Stop. */
export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  item_count: number;
  weight_kg: number;
  requires_signature: boolean;
}

/** A single stop within a Dispatch's sequenced route. */
export interface Stop {
  id: string;
  sequence: number;
  status: StopStatus;
  /** ISO 8601 timestamp, e.g. "2026-07-22T18:30:00Z" */
  eta: string;
  destination_address: DestinationAddress;
  order: Order;
}

/** Top-level Dispatch entity as returned by `GET /api/dispatches`. */
export interface Dispatch {
  id: string;
  reference_code: string;
  status: DispatchStatus;
  driver_name: string;
  vehicle_identifier: string;
  /** ISO 8601 timestamp, or null if the dispatch hasn't departed yet. */
  departed_at: string | null;
  warehouse: Warehouse;
  stops: Stop[];
}

// -----------------------------------------------------------------------------
// Cockpit-only aggregate types — dashboard telemetry, not raw backend entities.
// -----------------------------------------------------------------------------

/** Aggregate counters powering the left-rail live metrics feed. */
export interface OperationalMetrics {
  total_dispatches: number;
  pending_stops: number;
  live_delays: number;
  active_drivers: number;
}

/** A single row in the automated background ledger-generation log. */
export interface LedgerLogEntry {
  id: string;
  message: string;
  status: "success" | "processing" | "failed";
  created_at: string;
}