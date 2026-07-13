/**
 * Client-side helpers for uploading files. Both routes post multipart
 * form-data to an authenticated Next.js API route, which uploads to
 * Cloudinary server-side — the browser never sees Cloudinary credentials.
 */

async function postFile(url: string, form: FormData): Promise<string> {
  const res = await fetch(url, { method: "POST", body: form })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.data?.url) {
    throw new Error(json?.error ?? "Upload failed. Please try again.")
  }
  return json.data.url as string
}

/** Uploads a profile photo. Returns the public Cloudinary URL. */
export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData()
  form.append("file", file)
  return postFile("/api/upload/avatar", form)
}

/** Uploads task-completion proof for the given task. Returns a viewable URL. */
export async function uploadTaskProof(file: File, taskId: string): Promise<string> {
  const form = new FormData()
  form.append("file", file)
  form.append("task_id", taskId)
  return postFile("/api/upload/task-proof", form)
}
