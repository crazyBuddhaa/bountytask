import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function OffersLoading() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-6 w-32" />
      </div>
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
      <Card className="overflow-hidden p-0">
        <Skeleton className="w-full h-[640px]" />
      </Card>
    </div>
  )
}
