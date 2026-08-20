export default function NewDispatchLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Title text block skeleton */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="h-4 w-28 animate-pulse rounded-2xl bg-zinc-900/50" />
            <div className="h-6 w-72 animate-pulse rounded-2xl bg-zinc-900/50" />
            <div className="h-8 w-96 animate-pulse rounded-2xl bg-zinc-900/50" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-2xl bg-zinc-900/50" />
        </div>

        {/* Main large form card container */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm h-[700px]">
          <div className="space-y-3">
            {/* Card header skeleton */}
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded-xl bg-zinc-950/60" />
                <div className="h-6 w-48 animate-pulse rounded-xl bg-zinc-950/60" />
              </div>
              <div className="h-8 w-24 animate-pulse rounded-xl bg-zinc-950/60" />
            </div>

            {/* 5 consecutive horizontal list item strips */}
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse h-16 w-full rounded-2xl border border-zinc-800 bg-zinc-950/60"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}