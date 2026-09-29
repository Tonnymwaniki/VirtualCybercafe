// PDF tools for the Workbench, built on pdf-lib, which runs on the phone:
// photos to PDF, join, pick pages and split. Nothing is uploaded.

import { PDFDocument } from 'pdf-lib/cjs/index';

import { renamed, type WorkFile } from '@/lib/workbench/files';
import { editImage } from '@/lib/workbench/image';

// A4 in PDF points, with a 12 mm margin.
const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 34;

export class WorkbenchError extends Error {}

export async function openPdf(file: WorkFile) {
  try {
    return await PDFDocument.load(file.bytes, { updateMetadata: false });
  } catch (error) {
    if (error instanceof Error && /encrypt/i.test(error.message)) {
      throw new WorkbenchError(`${file.name} is locked with a password. Open it, save a copy without the password, and try again.`);
    }
    throw new WorkbenchError(`${file.name} couldn’t be opened. It may be damaged, or not really a PDF.`);
  }
}

async function finish(doc: PDFDocument, name: string): Promise<WorkFile> {
  const bytes = await doc.save({ useObjectStreams: true });
  return { name, kind: 'pdf', mimeType: 'application/pdf', bytes, pages: doc.getPageCount() };
}

export async function pageCount(file: WorkFile) {
  if (file.pages == null) file.pages = (await openPdf(file)).getPageCount();
  return file.pages;
}

// Adds one photo as an A4 page, turned to match the photo's shape.
async function addImagePage(doc: PDFDocument, file: WorkFile) {
  // pdf-lib reads JPEG and PNG only; anything else becomes a JPEG first.
  const usable = file.mimeType === 'image/jpeg' || file.mimeType === 'image/png' ? file : await editImage(file, {});
  const image = usable.mimeType === 'image/png' ? await doc.embedPng(usable.bytes) : await doc.embedJpg(usable.bytes);
  const landscape = image.width > image.height;
  const page = doc.addPage(landscape ? [A4.height, A4.width] : [A4.width, A4.height]);
  const { width, height } = page.getSize();
  const scale = Math.min((width - MARGIN * 2) / image.width, (height - MARGIN * 2) / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  page.drawImage(image, { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h });
}

// Photos and PDFs, in order, joined into one PDF.
export async function joinFiles(files: WorkFile[], name: string): Promise<WorkFile> {
  if (!files.length) throw new WorkbenchError('Add at least one file.');
  const doc = await PDFDocument.create();
  for (const file of files) {
    if (file.kind === 'image') {
      await addImagePage(doc, file);
    } else {
      const source = await openPdf(file);
      const pages = await doc.copyPages(source, source.getPageIndices());
      pages.forEach((page) => doc.addPage(page));
    }
  }
  return finish(doc, name);
}

// Pictures of a PDF's pages back into a PDF, each filling a page the same
// size as the original.
export async function picturesToPdf(original: WorkFile, pictures: WorkFile[], name: string): Promise<WorkFile> {
  const sizes = (await openPdf(original)).getPages().map((page) => page.getSize());
  const doc = await PDFDocument.create();
  for (const [i, picture] of pictures.entries()) {
    const image = await doc.embedJpg(picture.bytes);
    const size = sizes[i] ?? A4;
    const scale = Math.max(size.width, size.height) / Math.max(image.width, image.height);
    const page = doc.addPage([image.width * scale, image.height * scale]);
    page.drawImage(image, { x: 0, y: 0, width: image.width * scale, height: image.height * scale });
  }
  return finish(doc, name);
}

// A new PDF with only these pages (0-based), in this order.
export async function keepPages(file: WorkFile, indexes: number[], suffix = '-pages'): Promise<WorkFile> {
  if (!indexes.length) throw new WorkbenchError('Pick at least one page.');
  const source = await openPdf(file);
  const doc = await PDFDocument.create();
  const pages = await doc.copyPages(source, indexes);
  pages.forEach((page) => doc.addPage(page));
  return finish(doc, renamed(file.name, suffix, 'pdf'));
}

// One PDF per page.
export async function splitPages(file: WorkFile): Promise<WorkFile[]> {
  const total = await pageCount(file);
  const out: WorkFile[] = [];
  for (let i = 0; i < total; i++) out.push(await keepPages(file, [i], `-page-${i + 1}`));
  return out;
}

// Saves the PDF again with compact object streams. Lossless: text stays
// text. Helps a little on some PDFs, and not at all on scans.
export async function resavePdf(file: WorkFile): Promise<WorkFile> {
  const doc = await openPdf(file);
  return finish(doc, renamed(file.name, '-small', 'pdf'));
}

// "1-3, 5, 8-" -> [0, 1, 2, 4, 7, ... last]. Returns an error message for
// anything it can't read.
export function parsePages(text: string, total: number): number[] | string {
  const picked: number[] = [];
  const parts = text.split(/[,;\s]+/).filter(Boolean);
  if (!parts.length) return 'Type the pages you want, like 1-3, 5.';
  for (const part of parts) {
    const match = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part);
    if (!match || (!match[1] && !match[3])) return `“${part}” isn’t a page number.`;
    const from = match[1] ? Number(match[1]) : 1;
    const to = match[2] ? (match[3] ? Number(match[3]) : total) : from;
    if (from < 1 || to > total || from > to) return `This PDF has pages 1 to ${total}.`;
    for (let page = from; page <= to; page++) if (!picked.includes(page - 1)) picked.push(page - 1);
  }
  return picked;
}
