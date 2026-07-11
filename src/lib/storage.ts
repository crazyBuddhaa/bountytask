import { createClient } from "@/lib/supabase/client";

export type StorageBucket = "avatars" | "task-proofs";

/**
 * Upload a file to Supabase Storage from the browser.
 * Returns the public URL (for avatars) or the storage path (for proofs).
 */
export async function uploadFile(
  bucket: StorageBucket,
  userId: string,
  file: File,
  pathSuffix?: string
): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const suffix = pathSuffix ?? Date.now().toString();
  const path = `${userId}/${suffix}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  if (bucket === "avatars") {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  return path; // For private buckets return path, fetch signed URL separately
}

/**
 * Get a signed URL for a private file (e.g. task proof).
 * Expires in 1 hour.
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) throw new Error("Could not generate signed URL");
  return data.signedUrl;
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
