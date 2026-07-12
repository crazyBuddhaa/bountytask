import { NextResponse } from "next/server"
import { getAdvertiserSettings } from "@/lib/advertiser"

export const dynamic = 'force-dynamic'

/** Public — the /advertise page needs this before showing the intake form. */
export async function GET() {
  try {
    const data = await getAdvertiserSettings()
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ data: null, error: "Settings unavailable" }, { status: 500 })
  }
}
