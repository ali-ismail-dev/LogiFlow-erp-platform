export default function WarehousesLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-zinc-100 lg:px-12">
      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Header skeleton */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 pb-6">
          <div className="space-y-3">
            <div className="h-4 w-28 animate-pulse rounded-xl bg-zinc-900/40" />
            <div className="h-8 w-72 animate-pulse rounded-xl bg-zinc-900/40" />
            <div className="h-4 w-96 animate-pulse rounded-xl bg-zinc-900/40" />
          </div>
          <div className="h-10 w-44 animate-pulse rounded-xl bg-zinc-900/40" />
        </div>

        {/* Table skeleton */}
        <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-xl">
          <div className="space-y-3 p-6">
            {/* Table header row placeholder */}
            <div className="flex items-center justify-between border-b border-zinc-900/80 pb-3">
              <div className="h-8 w-32 animate-pulse rounded-xl bg-zinc-900/50" />
              <div className="h-8 w-24 animate-pulse rounded-xl bg-zinc-900/50" />
              <div className="h-8 w-36 animate-pulse rounded-xl bg-zinc-900/50" />
              <div className="h-8 w-28 animate-pulse rounded-xl bg-zinc-900/50" />
            </div>

            {/* 5 shimmering rows */}
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse h-14 w-full rounded-xl bg-zinc-900/50 border-t border-zinc-900/80"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}