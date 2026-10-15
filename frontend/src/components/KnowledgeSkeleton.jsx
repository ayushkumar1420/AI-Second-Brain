export default function KnowledgeSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-stone-200 dark:bg-zinc-800" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-2/3 rounded bg-stone-200 dark:bg-zinc-800" />
              <div className="mt-2 h-3 w-20 rounded bg-stone-100 dark:bg-zinc-800" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 rounded bg-stone-100 dark:bg-zinc-800" />
            <div className="h-3 rounded bg-stone-100 dark:bg-zinc-800" />
            <div className="h-3 w-3/4 rounded bg-stone-100 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
