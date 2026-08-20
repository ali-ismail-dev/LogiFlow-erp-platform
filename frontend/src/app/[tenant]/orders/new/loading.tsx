export default function NewOrderLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 md:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* Top title section skeleton */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="h-4 w-28 animate-pulse rounded-2xl bg-zinc-900/50" />
            <div className="h-6 w-64 animate-pulse rounded-2xl bg-zinc-900/50" />
            <div className="h-8 w-96 animate-pulse rounded-2xl bg-zinc-900/50" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-zinc-900/50" />
        </div>

        {/* 2-column cyberpunk cockpit body */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left panel – form skeleton */}
          <div className="animate-pulse rounded-3xl border border-zinc-800/40 bg-zinc-900/50 p-5 md:p-6 h-[600px]">
            <div className="space-y-6">
              {/* Form header */}
              <div className="space-y-3">
                <div className="h-4 w-32 animate-pulse rounded-xl bg-zinc-950/60" />
                <div className="h-6 w-48 animate-pulse rounded-xl bg-zinc-950/60" />
              </div>

              {/* Input fields */}
              <div className="grid gap-5 md:grid-cols-2">
                <div className="h-12 animate-pulse rounded-2xl bg-zinc-950/60" />
                <div className="h-12 animate-pulse rounded-2xl bg-zinc-950/60" />
              </div>
              <div className="h-12 animate-pulse rounded-2xl bg-zinc-950/60" />
              <div className="h-12 animate-pulse rounded-2xl bg-zinc-950/60" />

              {/* Address section */}
              <div className="rounded-2xl border border-zinc-800/40 bg-zinc-950/40 p-4 space-y-4">
                <div className="h-4 w-40 animate-pulse rounded-xl bg-zinc-900/50" />
                <div className="h-12 animate-pulse rounded-2xl bg-zinc-950/60" />
                <div className="h-12 animate-pulse rounded-2xl bg-zinc-950/60" />
              </div>

              {/* Submit button */}
              <div className="flex justify-end">
                <div className="h-12 w-44 animate-pulse rounded-2xl bg-zinc-950/60" />
              </div>
            </div>
          </div>

          {/* Right panel – warehouse roster list skeleton */}
          <div className="space-y-6">
            <div className="animate-pulse rounded-3xl border border-zinc-800/40 bg-zinc-900/50 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-2xl bg-zinc-950/60" />
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded-xl bg-zinc-950/60" />
                  <div className="h-6 w-40 animate-pulse rounded-xl bg-zinc-950/60" />
                </div>
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-2xl bg-zinc-950/60"
                  />
                ))}
              </div>
            </div>
            <div className="animate-pulse rounded-3xl border border-zinc-800/40 bg-zinc-900/50 p-5">
              <div className="h-4 w-32 animate-pulse rounded-xl bg-zinc-950/60" />
              <div className="mt-4 space-y-3">
                <div className="h-10 animate-pulse rounded-xl bg-zinc-950/60" />
                <div className="h-10 animate-pulse rounded-xl bg-zinc-950/60" />
                <div className="h-10 animate-pulse rounded-xl bg-zinc-950/60" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}