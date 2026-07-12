import { NextResponse } from "next/server"
import { getAdsSettings } from "@/lib/advertiser"

export const dynamic = 'force-dynamic'

/** Public — worker-facing pages need this to know whether/what to render. */
export async function GET() {
  try {
    const data = await getAdsSettings()
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ data: null, error: "Settings unavailable" }, { status: 500 })
  }
}
