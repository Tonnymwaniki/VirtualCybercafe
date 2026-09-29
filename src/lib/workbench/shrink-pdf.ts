// Makes a PDF smaller on the phone. First a lossless re-save (text stays
// text). If that isn't enough, each page is redrawn as a picture at the
// highest quality that fits, which is how scanned PDFs get small. A server
// with Ghostscript will do text PDFs better later.

import type { useEngine } from '@/components/workbench/engine';
import { renamed, type WorkFile } from '@/lib/workbench/files';
import { pageCount, picturesToPdf, resavePdf } from '@/lib/workbench/pdf';
import { track } from '@/lib/stats';

export type PdfShrinkResult = { file: WorkFile; reached: boolean; asPictures: boolean };

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
  const best = smallest && smallest.bytes.byteLength < resaved.bytes.byteLength ? smallest : resaved;
  return { file: best, reached: false, asPictures: best === smallest };
}
