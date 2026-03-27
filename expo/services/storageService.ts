import { supabase } from '@/lib/supabase';

const SCAN_PHOTOS_BUCKET = 'scan-photos';

export async function uploadScanPhoto(
  userId: string,
  familyId: string | null,
  fileName: string,
  fileData: Blob | ArrayBuffer | string,
  contentType: string = 'image/jpeg'
): Promise<{ path: string | null; error: string | null }> {
  try {
    const folder = familyId
      ? `${userId}/${familyId}`
      : `${userId}/personal`;

    const timestamp = Date.now();
    const storagePath = `${folder}/${timestamp}_${fileName}`;

    const { error } = await supabase.storage
      .from(SCAN_PHOTOS_BUCKET)
      .upload(storagePath, fileData, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('[StorageService] Upload failed:', error.message);
      return { path: null, error: error.message };
    }

    console.log('[StorageService] Uploaded:', storagePath);
    return { path: storagePath, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { path: null, error: msg };
  }
}

export async function getSignedUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<{ url: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(SCAN_PHOTOS_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      console.error('[StorageService] Signed URL failed:', error.message);
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { url: null, error: msg };
  }
}

export async function deleteScanPhoto(
  storagePath: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.storage
      .from(SCAN_PHOTOS_BUCKET)
      .remove([storagePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export function buildScopedPath(userId: string, familyId: string | null, filename: string): string {
  const folder = familyId ? `${userId}/${familyId}` : `${userId}/personal`;
  return `${folder}/${filename}`;
}

export function validateStoragePath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`);
}
