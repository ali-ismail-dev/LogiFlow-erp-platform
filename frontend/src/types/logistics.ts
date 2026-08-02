// src/types/logistics.ts
// -----------------------------------------------------------------------------
// Strict TypeScript contract mirroring the Laravel v13 backend DTO layer.
// Any drift here must be reconciled with `App\Http\Resources\*` on the backend
// before merging — this file is the single source of truth for the frontend.
// -----------------------------------------------------------------------------

/**
 * Lifecycle states for a Dispatch, mirrored 1:1 from the backend's
 * `DispatchStatus` PHP enum (App\Enums\DispatchStatus).
 *
 * NOTE: The backend does NOT have "pending" or "delayed" statuses.
 *       "planned" is the initial state. "in_transit", "completed",
 *       and "cancelled" are the other states. The Operations Cockpit
 *       dashboard logic accounts for this via string comparisons.
 */
export enum DispatchStatus {
  PLANNED = "planned",
  IN_TRANSIT = "in_transit",
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

/** Originating warehouse / distribution node for a Dispatch. */
export interface Warehouse {
  id: string;
  name: string;
  code: string;
  timezone: string;
  /** Full address string/object as returned by WarehouseResource */
  address: string | Record<string, unknown>;
}

/**
 * Order payload nested inside a Stop.
 * Mirrors App\Http\Resources\OrderResource exactly.
 */
export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  /** Full shipping address (object or string) as stored in the DB */
  shipping_address: string | Record<string, unknown>;
  /** Order lifecycle status string */
  status: string;
  /** Total weight in kilograms */
  total_weight_kg: number;
}

/** A single stop within a Dispatch's sequenced route. */
export interface Stop {
  id: string;
  sequence: number;
  status: StopStatus;
  /** ISO 8601 timestamp, e.g. "2026-07-22T18:30:00Z" */
  eta: string;
  /** ISO 8601 timestamp, nullable */
  arrived_at: string | null;
  /** ISO 8601 timestamp, nullable */
  completed_at: string | null;
  /** Optional failure reason string */
  failure_reason: string | null;
  destination_address: DestinationAddress | string | Record<string, unknown>;
  order: Order;
}

/** Top-level Dispatch entity as returned by `GET /api/v1/dispatches`. */
export interface Dispatch {
  id: string;
  reference_code: string;
  status: DispatchStatus;
  driver_name: string;
  vehicle_identifier: string;
  /** ISO 8601 timestamp, or null if the dispatch hasn't departed yet. */
  departed_at: string | null;
  /** ISO 8601 timestamp, or null if not yet scheduled */
  scheduled_at: string | null;
  /** ISO 8601 timestamp, or null if not yet completed */
  completed_at: string | null;
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
