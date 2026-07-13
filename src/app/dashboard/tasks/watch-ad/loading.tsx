import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function WatchAdLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-6 w-36" />
      </div>
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-8 flex flex-col items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-full" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  )
}
