import { callerId, signInRequired } from '@/server/caller';
import { limitMessages } from '@/server/usage';

// Passes a PDF to the Ghostscript server (servers/pdf-shrink) and returns the
// smaller copy. Used when shrinking on the phone isn't enough for a text PDF.
// The PDF server's address and key stay here on the app's server.
// Body: { pdf: base64, target: bytes }. Answer: { pdf: base64, level }.

const MAX_BASE64 = 28 * 1024 * 1024; // about a 20 MB PDF

function fromBase64(text: string) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function POST(request: Request) {
  const server = process.env.PDF_SERVER_URL?.replace(/\/+$/, '');
  const key = process.env.PDF_SERVER_KEY;
  if (!server || !key) return Response.json({ error: 'The PDF server isn’t set up yet.', notSetUp: true }, { status: 503 });
  if (signInRequired() && !(await callerId(request))) {
    return Response.json({ error: limitMessages.signIn, signIn: true }, { status: 401 });
  }
  let pdf: Uint8Array;
  let target = 0;
  try {
    const body = (await request.json()) as { pdf?: unknown; target?: unknown };
    if (typeof body.pdf !== 'string' || !body.pdf) return Response.json({ error: 'No PDF' }, { status: 400 });
    if (body.pdf.length > MAX_BASE64) return Response.json({ error: 'That PDF is too large for the server (20 MB most).' }, { status: 413 });
    pdf = fromBase64(body.pdf);
    target = Math.max(0, Math.round(Number(body.target) || 0));
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  try {
    const response = await fetch(`${server}/shrink?target=${target}`, {
      method: 'POST',
      headers: { 'X-Key': key, 'Content-Type': 'application/pdf' },
      body: pdf.buffer as ArrayBuffer,
    });
    if (!response.ok) {
      const reason = response.status === 422 ? 'The server couldn’t read this PDF.' : 'The PDF server had a problem.';
      return Response.json({ error: reason }, { status: 502 });
    }
    const result = new Uint8Array(await response.arrayBuffer());
    return Response.json({ pdf: toBase64(result), level: response.headers.get('X-Level') ?? '' });
  } catch {
    return Response.json({ error: 'Couldn’t reach the PDF server.' }, { status: 502 });
  }
}
