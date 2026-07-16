import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getDailyWord, getDailyNumber, todayUTC } from "@/lib/games"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const game = req.nextUrl.searchParams.get("game")
  const date = req.nextUrl.searchParams.get("date") ?? todayUTC()

  if (game === "wordle") {
    return NextResponse.json({ word: getDailyWord(date).toUpperCase(), date })
  }
  if (game === "higher-or-lower") {
    // NOTE: we return the number here (Phase 1: trust client, server validates on session record)
    return NextResponse.json({ number: getDailyNumber(date), date })
  }

  return NextResponse.json({ error: "Unknown game" }, { status: 400 })
}
