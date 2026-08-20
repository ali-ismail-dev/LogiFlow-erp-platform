export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header skeleton */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: logo + tenant name */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-lg border border-zinc-800/60 bg-zinc-900/50" />
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded-md bg-zinc-900/50" />
              <div className="h-3 w-24 animate-pulse rounded-md bg-zinc-900/50" />
            </div>
          </div>

          {/* Right: user profile block */}
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/60 py-1 pl-1 pr-3 sm:flex">
              <div className="h-7 w-7 animate-pulse rounded-full bg-zinc-900/50" />
              <div className="space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-zinc-900/50" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-zinc-900/50" />
              </div>
            </div>
            <div className="h-9 w-9 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/60" />
          </div>
        </div>
      </header>

      {/* Main skeleton content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Metrics grid – 3 boxes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse h-28 rounded-3xl border border-zinc-800/40 bg-zinc-900/50"
            />
          ))}
        </div>

        {/* Main 2-column body */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left column – larger dispatch cards area */}
          <div className="lg:col-span-8">
            <div className="rounded-3xl border border-zinc-800/40 bg-zinc-900/20 p-4">
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse h-24 rounded-2xl border border-zinc-800/40 bg-zinc-900/50"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right column – narrow activity log timeline */}
          <div className="lg:col-span-4">
            <div className="rounded-3xl border border-zinc-800/40 bg-zinc-900/20 p-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse h-12 rounded-xl border border-zinc-800/40 bg-zinc-900/50"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}