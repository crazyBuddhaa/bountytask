import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cloudinary, uploadBuffer } from "@/lib/cloudinary"

export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"]

function resourceTypeFor(mime: string): "image" | "video" | "raw" {
  if (mime === "application/pdf") return "raw"
  if (mime.startsWith("video/")) return "video"
  return "image"
}

/**
 * Uploads task-completion proof to Cloudinary and returns a URL the admin
 * approvals queue can open directly.
 *
 * Uploaded with delivery type "authenticated" rather than the default
 * "upload" — mirrors the old private Supabase bucket (only signed requests
 * can read the file, so proofs aren't publicly guessable/listable by URL).
 * We sign the delivery URL once here at upload time and store that signed
 * URL as-is; unlike Supabase's time-limited signed URLs this signature
 * doesn't expire on its own (Cloudinary's "authenticated" + sign_url has no
 * built-in TTL without the paid token-auth add-on), so no re-signing step is
 * needed when admins view it later — acceptable for a review queue where the
 * link only ever needs to work for people we already trust with the DB row.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  const taskId = form?.get("task_id")
  if (!(file instanceof File)) {
    return NextResponse.json({ data: null, error: "No file provided" }, { status: 400 })
  }
  if (typeof taskId !== "string" || !taskId) {
    return NextResponse.json({ data: null, error: "Missing task_id" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ data: null, error: "Unsupported file type." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ data: null, error: "File must be under 10 MB" }, { status: 400 })
  }

  const resourceType = resourceTypeFor(file.type)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadBuffer(buffer, {
      folder: `bountytask/task-proofs/${user.id}`,
      public_id: `${taskId}-${Date.now()}`,
      resource_type: resourceType,
      type: "authenticated",
    })

    const url = cloudinary.url(result.public_id, {
      resource_type: resourceType,
      type: "authenticated",
      sign_url: true,
      secure: true,
    })

    return NextResponse.json({ data: { url }, error: null })
  } catch (e) {
    return NextResponse.json(
      { data: null, error: e instanceof Error ? e.message : "Upload failed. Please try again." },
      { status: 500 }
    )
  }
}
