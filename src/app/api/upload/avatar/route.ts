import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { uploadBuffer } from "@/lib/cloudinary"

export const dynamic = 'force-dynamic'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

/**
 * Uploads a profile photo to Cloudinary. Replaces the old direct
 * browser-to-Supabase-Storage upload — the file now goes through this
 * authenticated server route so the Cloudinary API secret never reaches the
 * client, and we can validate type/size/ownership before anything is stored.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ data: null, error: "No file provided" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ data: null, error: "Unsupported file type. Use JPEG, PNG, WEBP or GIF." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ data: null, error: "Avatar must be under 2 MB" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadBuffer(buffer, {
      folder: `bountytask/avatars/${user.id}`,
      public_id: "avatar",
      overwrite: true,
      invalidate: true,
      resource_type: "image",
      type: "upload",
    })
    return NextResponse.json({ data: { url: result.secure_url }, error: null })
  } catch (e) {
    return NextResponse.json(
      { data: null, error: e instanceof Error ? e.message : "Upload failed. Please try again." },
      { status: 500 }
    )
  }
}
