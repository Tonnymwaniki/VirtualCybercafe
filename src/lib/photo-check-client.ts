import { apiFetch, throwIfFailed } from '@/lib/api';
import { failureText } from '@/lib/failure';
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
    await throwIfFailed(response);
    return (await response.json()) as PhotoVerdict;
  } catch (error) {
    return { available: false, reason: failureText('The AI photo check didn’t run. The size checks above still count.', error) };
  }
}
