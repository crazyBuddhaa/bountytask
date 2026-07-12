import { NextResponse } from "next/server"
import { getVerificationSettings } from "@/lib/verification"

export const dynamic = 'force-dynamic'

/** Public — the withdrawal page needs this before the user is asked to pay. */
export async function GET() {
  try {
    const data = await getVerificationSettings()
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ data: null, error: "Settings unavailable" }, { status: 500 })
  }
}
