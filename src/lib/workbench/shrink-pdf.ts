// Makes a PDF smaller on the phone. First a lossless re-save (text stays
// text). If that isn't enough, each page is redrawn as a picture at the
// highest quality that fits, which is how scanned PDFs get small. Before
// that, when the app is online, the Ghostscript server (servers/pdf-shrink)
// gets a try: it shrinks the pictures inside a PDF but keeps text as text.
// The server deletes the file as soon as it answers.

import type { useEngine } from '@/components/workbench/engine';
import { apiFetch } from '@/lib/api';
import { fromBase64, renamed, toBase64, type WorkFile } from '@/lib/workbench/files';
import { pageCount, picturesToPdf, resavePdf } from '@/lib/workbench/pdf';
import { track } from '@/lib/stats';

export type PdfShrinkResult = { file: WorkFile; reached: boolean; asPictures: boolean };

const SERVER_MAX_BYTES = 20 * 1024 * 1024;

// The server's smaller copy, or null when it isn't set up, can't be reached
// or didn't help.
async function serverShrink(file: WorkFile, maxBytes: number, name: string): Promise<WorkFile | null> {
  if (file.bytes.byteLength > SERVER_MAX_BYTES) return null;
  try {
    const response = await apiFetch('/api/pdf-shrink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: toBase64(file.bytes), target: maxBytes }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { pdf?: string };
    if (!body.pdf) return null;
    const bytes = fromBase64(body.pdf);
    if (bytes.byteLength >= file.bytes.byteLength) return null;
    track('workbench.shrink_pdf_server');
    return { name, kind: 'pdf', mimeType: 'application/pdf', bytes, pages: file.pages };
  } catch {
    return null;
  }
}

// From sharpest to smallest. The last one is still readable on a phone.
const LEVELS = [
  { maxSide: 2000, quality: 0.8 },
  { maxSide: 1700, quality: 0.7 },
  { maxSide: 1400, quality: 0.65 },
  { maxSide: 1200, quality: 0.55 },
  { maxSide: 1000, quality: 0.5 },
];

export async function shrinkPdf(
  file: WorkFile,
  maxBytes: number,
  engine: ReturnType<typeof useEngine>,
  onProgress?: (text: string) => void,
): Promise<PdfShrinkResult> {
  track('workbench.shrink_pdf');
  const name = renamed(file.name, '-small', 'pdf');
  const resaved = await resavePdf(file);
  if (resaved.bytes.byteLength <= maxBytes) return { file: resaved, reached: true, asPictures: false };

  onProgress?.('Shrinking on the PDF server…');
  const served = await serverShrink(resaved, maxBytes, name);
  if (served && served.bytes.byteLength <= maxBytes) return { file: served, reached: true, asPictures: false };

  const total = await pageCount(file);
  let smallest: WorkFile | null = null;
  // Guess where to start from how far over the limit the file is.
  const ratio = file.bytes.byteLength / maxBytes;
  const first = ratio > 6 ? 2 : ratio > 3 ? 1 : 0;
  for (let level = first; level < LEVELS.length; level++) {
    const setting = LEVELS[level];
    onProgress?.(`Trying level ${level + 1} of ${LEVELS.length}…`);
    const pages = await engine.renderPdf(file, { scale: 3, maxSide: setting.maxSide, quality: setting.quality }, (_, count) =>
      onProgress?.(`Level ${level + 1}: page ${Math.min(count, total)} of ${total}`),
    );
    const rebuilt = await picturesToPdf(file, pages, name);
    if (!smallest || rebuilt.bytes.byteLength < smallest.bytes.byteLength) smallest = rebuilt;
    if (rebuilt.bytes.byteLength <= maxBytes) return { file: rebuilt, reached: true, asPictures: true };
  }
  const candidates = [resaved, served, smallest].filter((f): f is WorkFile => !!f);
  const best = candidates.reduce((a, b) => (b.bytes.byteLength < a.bytes.byteLength ? b : a));
  return { file: best, reached: false, asPictures: best === smallest };
}
