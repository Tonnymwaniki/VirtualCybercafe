// Passport photos: the digital photo for online forms and a sheet of print
// photos for a cyber to print and cut. The face is never changed; the photo
// is only cropped, resized and compressed.

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib/cjs/index';

import { renamed, type WorkFile } from '@/lib/workbench/files';
import { editImage, imageSize, shrinkImage } from '@/lib/workbench/image';
import { track } from '@/lib/stats';

export const PASSPORT_SIDE = 600;
export const PASSPORT_MAX_BYTES = 200 * 1024;

export type PrintSize = 'kenya' | 'visa';

// Kenyan passport photos print at 2 × 2 inches (Kenya Embassy e-passport
// guide); 35 × 45 mm is the usual size for visas and many other forms.
export const printSizes: Record<PrintSize, { label: string; widthMm: number; heightMm: number; columns: number; rows: number }> = {
  kenya: { label: '2 × 2 in (Kenyan passport)', widthMm: 50.8, heightMm: 50.8, columns: 3, rows: 2 },
  visa: { label: '35 × 45 mm (visas and other forms)', widthMm: 35, heightMm: 45, columns: 4, rows: 2 },
};

const MM = 72 / 25.4;
const A4 = { width: 595.28, height: 841.89 };
const DPI = 300;

// A crop of the given shape, centred across and a little above the middle,
// where the face usually is in a portrait photo.
async function cropFor(file: WorkFile, aspect: number) {
  const { width, height } = await imageSize(file);
  const cropWidth = Math.min(width, Math.round(height * aspect));
  const cropHeight = Math.min(height, Math.round(width / aspect));
  return {
    originX: Math.floor((width - cropWidth) / 2),
    originY: Math.floor((height - cropHeight) * 0.3),
    width: cropWidth,
    height: cropHeight,
  };
}

// The digital photo: 600 × 600 JPG under 200 KB.
export async function digitalPassport(file: WorkFile): Promise<{ file: WorkFile; sharpEnough: boolean }> {
  track('workbench.passport');
  const { width, height } = await imageSize(file);
  const square = await editImage(file, { crop: await cropFor(file, 1) }, 'jpg', 0.95);
  const { file: out } = await shrinkImage(square, PASSPORT_MAX_BYTES, { exact: { width: PASSPORT_SIDE, height: PASSPORT_SIDE } });
  return { file: { ...out, name: 'passport-photo.jpg' }, sharpEnough: Math.min(width, height) >= PASSPORT_SIDE };
}

// An A4 PDF with several print photos at the right size and grey cut lines,
// laid out at the top of the page.
export async function passportSheet(file: WorkFile, size: PrintSize = 'kenya'): Promise<WorkFile> {
  track(`workbench.passport_sheet_${size}`);
  const spec = printSizes[size];
  const pixels = { width: Math.round((spec.widthMm / 25.4) * DPI), height: Math.round((spec.heightMm / 25.4) * DPI) };
  const cropped = await editImage(file, { crop: await cropFor(file, spec.widthMm / spec.heightMm) }, 'jpg', 0.95);
  const print = await editImage(cropped, { exact: pixels }, 'jpg', 0.92);

  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.width, A4.height]);
  const image = await doc.embedJpg(print.bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const w = spec.widthMm * MM;
  const h = spec.heightMm * MM;
  const gap = 4 * MM;
  const left = (A4.width - (spec.columns * w + (spec.columns - 1) * gap)) / 2;
  const top = A4.height - 15 * MM;
  for (let row = 0; row < spec.rows; row++) {
    for (let col = 0; col < spec.columns; col++) {
      const x = left + col * (w + gap);
      const y = top - (row + 1) * h - row * gap;
      page.drawImage(image, { x, y, width: w, height: h });
      page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.4 });
    }
  }
  const below = top - spec.rows * h - (spec.rows - 1) * gap - 8 * MM;
  page.drawText(`${spec.rows * spec.columns} photos, ${spec.label}. Print at 100% (actual size), not "fit to page", then cut along the grey lines.`, {
    x: left,
    y: below,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  const bytes = await doc.save();
  return { name: renamed('passport-photos', `-${size === 'kenya' ? '2x2in' : '35x45mm'}`, 'pdf'), kind: 'pdf', mimeType: 'application/pdf', bytes, pages: 1 };
}
