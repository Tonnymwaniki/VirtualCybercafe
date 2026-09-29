import { apiFetch } from '@/lib/api';
import { sampleCv, type CvAnswers, type CvResponse } from '@/lib/cv';

// Asks the server to write the CV; falls back to the local template when the
// server can't be reached.
export async function requestCv(answers: CvAnswers): Promise<CvResponse> {
  try {
    const response = await apiFetch('/api/cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    if (!response.ok) throw new Error(`CV request failed: ${response.status}`);
    return (await response.json()) as CvResponse;
  } catch {
    return { cv: sampleCv(answers), mode: 'sample' };
  }
}
