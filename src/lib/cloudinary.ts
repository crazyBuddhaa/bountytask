import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export { cloudinary }

/** Uploads a buffer to Cloudinary. Server-side only — needs CLOUDINARY_API_SECRET. */
export function uploadBuffer(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"))
      resolve(result)
    })
    stream.end(buffer)
  })
}

/** Removes an uploaded asset (used to clean up on overwrite/failure paths). */
export async function destroyAsset(publicId: string, resourceType: "image" | "video" | "raw", type: "upload" | "authenticated" = "upload") {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type }).catch(() => {})
}
