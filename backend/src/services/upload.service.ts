import { supabase, STORAGE_BUCKET } from '../lib/supabase';
import { ApiError } from '../middleware/errorHandler';
import path from 'path';

// ── Upload file to Supabase Storage ───────────────────────────────────────
export const uploadFile = async (
  file: Express.Multer.File,
  folder: 'receipts' | 'materials' | 'logos' = 'receipts',
  bucketName: string = STORAGE_BUCKET
): Promise<string> => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

  if (!allowedTypes.includes(ext)) {
    throw new ApiError(400, `File type ${ext} is not allowed. Use: JPG, PNG, WEBP, or PDF.`);
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new ApiError(400, 'File size exceeds the 10MB limit.');
  }

  const timestamp = Date.now();
  const safeName = file.originalname.replace(/[^a-z0-9.-]/gi, '_');
  const storagePath = `${folder}/${timestamp}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new ApiError(500, `File upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
};

// ── Delete file from Supabase Storage ─────────────────────────────────────
export const deleteFile = async (publicUrl: string): Promise<void> => {
  // Extract path from URL
  const urlParts = publicUrl.split(`${STORAGE_BUCKET}/`);
  if (urlParts.length < 2) {
    throw new ApiError(400, 'Invalid file URL provided for deletion.');
  }

  const filePath = urlParts[1];
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);

  if (error) {
    throw new ApiError(500, `Failed to delete file: ${error.message}`);
  }
};
