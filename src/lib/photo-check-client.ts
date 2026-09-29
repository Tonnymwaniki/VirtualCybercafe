import { apiFetch } from '@/lib/api';
import type { PhotoVerdict } from '@/lib/photo-check-types';
import { toBase64, type WorkFile } from '@/lib/workbench/files';
import { editImage } from '@/lib/workbench/image';

// Sends a small copy of the photo (enough to judge it, cheap to send).
export async function checkPhotoAi(file: WorkFile): Promise<PhotoVerdict> {
  try {
    const small = await editImage(file, { maxSide: 800 }, 'jpg', 0.8);
    const response = await apiFetch('/api/photo-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: toBase64(small.bytes) }),
    });
    const body = await response.json().catch(() => null);
    if (response.status === 429) return { available: false, reason: body?.error ?? 'Today’s AI limit is reached. Try again tomorrow.' };
    if (!response.ok || !body) return { available: false, reason: 'The photo check is unavailable right now.' };
    return body as PhotoVerdict;
  } catch {
    return { available: false, reason: 'Couldn’t reach the photo check. Check your connection.' };
  }
}
