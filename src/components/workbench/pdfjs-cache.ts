// Keeps pdf.js on the phone after its first download, so the Workbench can
// read PDF pages offline and doesn't spend data on it again.

import { File, Paths } from 'expo-file-system';

import { PDFJS_BASE } from '@/components/workbench/engine-html';

const VERSION = PDFJS_BASE.match(/pdf\.js\/([^/]+)\//)?.[1] ?? 'x';
const parts = { main: 'pdf.min.js', worker: 'pdf.worker.min.js' } as const;
const kept = (part: keyof typeof parts) => new File(Paths.document, `pdfjs-${VERSION}-${parts[part]}`);

// The kept copy, or null when it hasn't been downloaded yet.
export async function keptPdfJs(): Promise<{ main: string; worker: string } | null> {
  try {
    const main = kept('main');
    const worker = kept('worker');
    if (!main.exists || !worker.exists) return null;
    return { main: await main.text(), worker: await worker.text() };
  } catch {
    return null;
  }
}

let saving: Promise<void> | null = null;

// Downloads a copy once pdf.js has been used online.
export function keepPdfJs() {
  saving ??= (async () => {
    for (const part of ['main', 'worker'] as const) {
      const file = kept(part);
      if (file.exists) continue;
      const response = await fetch(PDFJS_BASE + parts[part]);
      if (!response.ok) throw new Error(`pdf.js ${response.status}`);
      const text = await response.text();
      const partial = new File(Paths.document, `${file.name}.part`);
      partial.write(text);
      await partial.move(file);
    }
  })().catch(() => {
    saving = null;
  });
  return saving;
}
