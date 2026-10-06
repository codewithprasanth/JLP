import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from '../../config/env';
import { HttpError } from '../errors';

export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadMenuImage(fileBuffer: Buffer): Promise<{ imageUrl: string; publicId: string }> {
  if (!cloudinaryEnabled) {
    throw new HttpError(503, 'Image upload is not configured (set CLOUDINARY_* env vars)');
  }
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'menu-items', resource_type: 'image' },
      (err, res) => (err || !res ? reject(err ?? new Error('Upload failed')) : resolve(res)),
    );
    stream.end(fileBuffer);
  });
  return { imageUrl: result.secure_url, publicId: result.public_id };
}

/** Best-effort: a failed cleanup must not fail the request that triggered it. */
export async function deleteMenuImage(publicId: string | null | undefined): Promise<void> {
  if (!publicId || !cloudinaryEnabled) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`Failed to delete Cloudinary asset ${publicId}:`, err);
  }
}
