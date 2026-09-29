import { guessCategory } from '@/data/locker';
import { parsePages } from '@/lib/workbench/pdf';

describe('page lists', () => {
  it('reads ranges and single pages, without repeats', () => {
    expect(parsePages('1-3, 5', 6)).toEqual([0, 1, 2, 4]);
    expect(parsePages('2 2 3', 4)).toEqual([1, 2]);
    expect(parsePages('4-', 6)).toEqual([3, 4, 5]);
  });

  it('explains pages that are out of range or not numbers', () => {
    expect(parsePages('7', 6)).toBe('This PDF has pages 1 to 6.');
    expect(parsePages('abc', 6)).toMatch(/isn’t a page number/);
    expect(parsePages('', 6)).toMatch(/Type the pages/);
  });
});

describe('Locker folders from file names', () => {
  it.each([
    ['My CV 2026.pdf', 'application/pdf', 'CV'],
    ['cover-letter.docx', 'application/msword', 'CV'],
    ['national_id_front.jpg', 'image/jpeg', 'ID'],
    ['passport.jpg', 'image/jpeg', 'ID'],
    ['KCSE certificate.pdf', 'application/pdf', 'Certificates'],
    ['good conduct.pdf', 'application/pdf', 'Certificates'],
    ['IMG_2041.jpg', 'image/jpeg', 'Photos'],
    ['invoice.pdf', 'application/pdf', 'Documents'],
  ])('%s goes to %s', (name, mime, folder) => {
    expect(guessCategory(name, mime)).toBe(folder);
  });
});

describe('PDF tools', () => {
  // A small PDF with the given number of pages.
  async function samplePdf(pages: number, name = 'sample.pdf') {
    const { PDFDocument } = require('pdf-lib/cjs/index');
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) doc.addPage([200, 300 + i]);
    return { name, kind: 'pdf' as const, mimeType: 'application/pdf', bytes: await doc.save() };
  }

  it('joins PDFs and keeps chosen pages', async () => {
    const { joinFiles, keepPages, pageCount, splitPages } = require('@/lib/workbench/pdf');
    const joined = await joinFiles([await samplePdf(2, 'a.pdf'), await samplePdf(3, 'b.pdf')], 'both.pdf');
    expect(await pageCount(joined)).toBe(5);
    const kept = await keepPages(joined, [0, 4]);
    expect(await pageCount(kept)).toBe(2);
    expect(await splitPages(await samplePdf(3))).toHaveLength(3);
  });
});
