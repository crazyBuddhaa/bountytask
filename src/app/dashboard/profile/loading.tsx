import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function ProfileLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-28 mb-1" />
        <Skeleton className="h-4 w-52" />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5 mb-6">
            <Skeleton className="h-20 w-20 rounded-full shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t space-y-2">
            <Skeleton className="h-4 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-20 rounded-md" />
            </div>
          </div>

          <Skeleton className="h-10 w-28 rounded-md mt-6" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
