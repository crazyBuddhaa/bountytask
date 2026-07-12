"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PlatformReport } from "./PlatformReport"
import { WebsiteAnalytics } from "./WebsiteAnalytics"
import type { Period } from "./period"

export default function AdminReportsPage() {
  const [period, setPeriod] = useState<Period>("30d")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform growth and website traffic trends.</p>
        </div>
        <div className="flex gap-1">
          {(["7d", "30d", "90d"] as Period[]).map(p => (
            <Button key={p} variant={period === p ? "default" : "outline"} size="sm"
              onClick={() => setPeriod(p)} className="w-14">
              {p}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="website">
        <TabsList>
          <TabsTrigger value="website">Website Analytics</TabsTrigger>
          <TabsTrigger value="platform">Platform</TabsTrigger>
        </TabsList>
        <TabsContent value="website">
          <WebsiteAnalytics period={period} />
        </TabsContent>
        <TabsContent value="platform">
          <PlatformReport period={period} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
