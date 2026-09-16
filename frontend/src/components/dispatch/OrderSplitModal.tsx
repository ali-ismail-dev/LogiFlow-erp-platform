"use client";

export interface SuggestedBatch {
  batch_number: number;
  order_ids: number[];
  batch_weight_kg: number;
  recommended_vehicle: string | null;
}

export interface OrderSplitModalProps {
  isOpen: boolean;
  totalWeightKg: number;
  batches: SuggestedBatch[];
  onCreateFirstBatch: (batch: SuggestedBatch) => void | Promise<void>;
  onClose: () => void;
}

export function OrderSplitModal({
  isOpen,
  totalWeightKg,
  batches,
  onCreateFirstBatch,
  onClose,
}: OrderSplitModalProps) {
  if (!isOpen) {
    return null;
  }

  const firstBatch = batches[0];
  const remainingOrderCount = batches.slice(1).reduce((count, batch) => count + batch.order_ids.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="order-split-title" className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">Capacity exceeded</p>
            <h2 id="order-split-title" className="mt-1 text-lg font-semibold text-zinc-100">Create a split dispatch plan</h2>
            <p className="mt-1 text-sm text-zinc-400">{totalWeightKg.toLocaleString()} kg is distributed across {batches.length} dispatches.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close order split dialog" className="text-xl leading-none text-zinc-500 hover:text-zinc-200">×</button>
        </div>

        <div className="mt-5 space-y-2">
          {batches.map((batch) => (
            <div key={batch.batch_number} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-sm">
              <div>
                <p className="font-medium text-zinc-200">Batch {batch.batch_number}</p>
                <p className="text-xs text-zinc-500">{batch.order_ids.length} orders · {batch.batch_weight_kg.toLocaleString()} kg</p>
              </div>
              <span className="font-mono text-xs text-emerald-300">{batch.recommended_vehicle ?? "Assign vehicle"}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500">{remainingOrderCount} orders remain for a secondary dispatch.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200">Review manually</button>
            <button type="button" disabled={!firstBatch} onClick={() => firstBatch && onCreateFirstBatch(firstBatch)} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">Create Batch 1</button>
          </div>
        </div>
      </div>
    </div>
  );
}