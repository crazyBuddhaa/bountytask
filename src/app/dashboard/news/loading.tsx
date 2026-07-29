import { Skeleton } from "@/components/ui/skeleton"

export default function NewsLoading() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Earn progress bar */}
      <Skeleton className="h-20 w-full rounded-xl" />

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Article cards */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border p-4 flex gap-4">
            <Skeleton className="w-24 h-20 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
