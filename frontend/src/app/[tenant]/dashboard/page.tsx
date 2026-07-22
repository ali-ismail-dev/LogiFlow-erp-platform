// src/app/[tenant]/dashboard/page.tsx
import type { Dispatch, OperationalMetrics, LedgerLogEntry } from "@/types/logistics";
import { DispatchStatus, StopStatus } from "@/types/logistics";
import { MetricsFeed } from "../../../components/dashboard/metrics-feed";
import { DispatchBoard } from "../../../components/dashboard/dispatch-board";
import { MonitoringSidebar } from "../../../components/dashboard/monitoring-sidebar";

interface DashboardPageProps {
  params: { tenant: string };
}

// ---------------------------------------------------------------------------
// Mock data initialization — the Server Component's job per the architecture
// brief. Each function stands in for a tenant-scoped call against the Laravel
// domain layer (e.g. `https://${tenant}.api.logiflow.internal/v1/dispatches`).
// Swap the bodies for real fetch/gateway calls — the return shapes already
// satisfy the contract in `src/types/logistics.ts`.
// ---------------------------------------------------------------------------

async function fetchDispatches(tenant: string): Promise<Dispatch[]> {
  await new Promise((resolve) => setTimeout(resolve, 40));

  const northBay = {
    id: "wh_02",
    name: "North Bay Distribution",
    code: "NBD-02",
    timezone: "America/Los_Angeles",
    latitude: 37.8044,
    longitude: -122.2712,
  };
  const eastside = {
    id: "wh_07",
    name: "Eastside Fulfillment Hub",
    code: "EFH-07",
    timezone: "America/Los_Angeles",
    latitude: 37.5483,
    longitude: -121.9886,
  };

  return [
    {
      id: "dsp_8841",
      reference_code: "DSP-8841",
      status: DispatchStatus.IN_TRANSIT,
      driver_name: "Marcus Idris",
      vehicle_identifier: "VAN-014",
      departed_at: "2026-07-22T18:05:00Z",
      warehouse: northBay,
      stops: [
        {
          id: "stp_1",
          sequence: 1,
          status: StopStatus.COMPLETED,
          eta: "2026-07-22T18:40:00Z",
          destination_address: { line1: "412 Harrow St", city: "Oakland", state: "CA", postal_code: "94612", country: "US" },
          order: { id: "ord_5501", order_number: "ORD-5501", customer_name: "Callo & Vance LLP", item_count: 3, weight_kg: 18.4, requires_signature: true },
        },
        {
          id: "stp_2",
          sequence: 2,
          status: StopStatus.EN_ROUTE,
          eta: "2026-07-22T19:25:00Z",
          destination_address: { line1: "88 Telegraph Ave", city: "Berkeley", state: "CA", postal_code: "94704", country: "US" },
          order: { id: "ord_5502", order_number: "ORD-5502", customer_name: "Nourish Market Co-op", item_count: 12, weight_kg: 64.0, requires_signature: false },
        },
      ],
    },
    {
      id: "dsp_8842",
      reference_code: "DSP-8842",
      status: DispatchStatus.DELAYED,
      driver_name: "Priya Chandrasekaran",
      vehicle_identifier: "TRK-221",
      departed_at: "2026-07-22T17:10:00Z",
      warehouse: eastside,
      stops: [
        {
          id: "stp_3",
          sequence: 1,
          status: StopStatus.ARRIVED,
          eta: "2026-07-22T17:50:00Z",
          destination_address: { line1: "2200 Walnut Ave", city: "Fremont", state: "CA", postal_code: "94538", country: "US" },
          order: { id: "ord_5510", order_number: "ORD-5510", customer_name: "Bramwell Dental Group", item_count: 2, weight_kg: 6.2, requires_signature: true },
        },
        {
          id: "stp_4",
          sequence: 2,
          status: StopStatus.FAILED,
          eta: "2026-07-22T18:15:00Z",
          destination_address: { line1: "556 Mission St", city: "San Francisco", state: "CA", postal_code: "94105", country: "US" },
          order: { id: "ord_5511", order_number: "ORD-5511", customer_name: "Union Square Bistro", item_count: 8, weight_kg: 22.7, requires_signature: false },
        },
        {
          id: "stp_5",
          sequence: 3,
          status: StopStatus.PENDING,
          eta: "2026-07-22T19:05:00Z",
          destination_address: { line1: "77 Innovation Way", city: "Fremont", state: "CA", postal_code: "94538", country: "US" },
          order: { id: "ord_5512", order_number: "ORD-5512", customer_name: "Kestrel Robotics Inc", item_count: 5, weight_kg: 41.0, requires_signature: true },
        },
      ],
    },
    {
      id: "dsp_8843",
      reference_code: "DSP-8843",
      status: DispatchStatus.PENDING,
      driver_name: "Elena Vasquez",
      vehicle_identifier: "VAN-009",
      departed_at: null,
      warehouse: northBay,
      stops: [
        {
          id: "stp_6",
          sequence: 1,
          status: StopStatus.PENDING,
          eta: "2026-07-22T21:00:00Z",
          destination_address: { line1: "1500 Park St", city: "Alameda", state: "CA", postal_code: "94501", country: "US" },
          order: { id: "ord_5520", order_number: "ORD-5520", customer_name: "Hartley & Finch Antiques", item_count: 1, weight_kg: 3.1, requires_signature: false },
        },
        {
          id: "stp_7",
          sequence: 2,
          status: StopStatus.PENDING,
          eta: "2026-07-22T21:35:00Z",
          destination_address: { line1: "910 Central Ave", city: "Alameda", state: "CA", postal_code: "94501", country: "US" },
          order: { id: "ord_5521", order_number: "ORD-5521", customer_name: "Riverside Youth Center", item_count: 20, weight_kg: 88.5, requires_signature: true },
        },
      ],
    },
    {
      id: "dsp_8839",
      reference_code: "DSP-8839",
      status: DispatchStatus.COMPLETED,
      driver_name: "Tomasz Nowak",
      vehicle_identifier: "TRK-118",
      departed_at: "2026-07-22T13:00:00Z",
      warehouse: eastside,
      stops: [
        {
          id: "stp_8",
          sequence: 1,
          status: StopStatus.COMPLETED,
          eta: "2026-07-22T13:45:00Z",
          destination_address: { line1: "3300 Zanker Rd", city: "San Jose", state: "CA", postal_code: "95134", country: "US" },
          order: { id: "ord_5490", order_number: "ORD-5490", customer_name: "Whitfield Logistics Partners", item_count: 40, weight_kg: 210.0, requires_signature: true },
        },
        {
          id: "stp_9",
          sequence: 2,
          status: StopStatus.COMPLETED,
          eta: "2026-07-22T14:20:00Z",
          destination_address: { line1: "1180 Coleman Ave", city: "San Jose", state: "CA", postal_code: "95110", country: "US" },
          order: { id: "ord_5491", order_number: "ORD-5491", customer_name: "Solano Family Dentistry", item_count: 2, weight_kg: 4.8, requires_signature: false },
        },
      ],
    },
  ];
}

async function fetchOperationalMetrics(tenant: string): Promise<OperationalMetrics> {
  await new Promise((resolve) => setTimeout(resolve, 30));
  return { total_dispatches: 4, pending_stops: 3, live_delays: 1, active_drivers: 2 };
}

async function fetchLedgerEntries(tenant: string): Promise<LedgerLogEntry[]> {
  await new Promise((resolve) => setTimeout(resolve, 25));
  return [
    { id: "ldg_1", message: "Invoice batch #482 reconciled", status: "success", created_at: "2026-07-22T18:58:00Z" },
    { id: "ldg_2", message: "Fuel surcharge ledger sync running", status: "processing", created_at: "2026-07-22T18:55:00Z" },
    { id: "ldg_3", message: "Driver payout batch #117 posted", status: "success", created_at: "2026-07-22T18:41:00Z" },
    { id: "ldg_4", message: "Warehouse NBD-02 manifest export failed", status: "failed", created_at: "2026-07-22T18:22:00Z" },
  ];
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { tenant } = params;

  const [dispatches, metrics, ledgerEntries] = await Promise.all([
    fetchDispatches(tenant),
    fetchOperationalMetrics(tenant),
    fetchLedgerEntries(tenant),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-5 lg:px-8">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            Operations Cockpit
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-50">{formatTenantName(tenant)}</h1>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-zinc-800/60 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-400 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-mono tracking-tight">{tenant}</span>
          <span className="text-zinc-600">·</span>
          live session
        </div>
      </header>

      <main className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-12 lg:gap-6 lg:p-8">
        <aside className="lg:col-span-2">
          <MetricsFeed initialMetrics={metrics} />
        </aside>

        <section className="lg:col-span-7">
          <DispatchBoard initialDispatches={dispatches} />
        </section>

        <aside className="lg:col-span-3">
          <MonitoringSidebar dispatches={dispatches} initialLedgerEntries={ledgerEntries} />
        </aside>
      </main>
    </div>
  );
}

function formatTenantName(tenant: string): string {
  return tenant
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}