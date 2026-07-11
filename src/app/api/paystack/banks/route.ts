import { NextResponse } from "next/server"
import { fetchBanks } from "@/lib/paystack"

export const revalidate = 3600 // Cache 1hr at edge

export async function GET() {
  try {
    const banks = await fetchBanks()
    return NextResponse.json({ data: banks, error: null })
  } catch (e: unknown) {
    return NextResponse.json({ data: null, error: (e as Error).message }, { status: 502 })
  }
}
