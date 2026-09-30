import type { FileMeta } from '@/lib/chat-types';
import { fileIntent } from '@/lib/file-intent';

const pdf: FileMeta = { id: 'p1', name: 'letter.pdf', kind: 'pdf', bytes: 7_400_000, pages: 3 };
const photo: FileMeta = { id: 'i1', name: 'me.jpg', kind: 'image', bytes: 2_000_000, width: 3000, height: 4000 };

describe('free file requests in the chat', () => {
  it('shrinks a PDF under a size', () => {
    expect(fileIntent('make this PDF under 1MB', [pdf])).toMatchObject({ op: 'shrink', fileIds: ['p1'], maxKB: 1024 });
    expect(fileIntent('punguza iwe chini ya 500kb', [pdf])).toMatchObject({ op: 'shrink', maxKB: 500 });
  });

  it('resizes a photo to exact pixels', () => {
    expect(fileIntent('600x600', [photo])).toMatchObject({ op: 'resize', width: 600, height: 600, exact: true });
  });

  it('makes a passport photo, with the visa size when asked', () => {
    expect(fileIntent('passport photo please', [photo])).toMatchObject({ op: 'passport', printSize: 'kenya' });
    expect(fileIntent('passport photo 35x45 for a visa', [photo])).toMatchObject({ op: 'passport', printSize: 'visa' });
    expect(fileIntent('nataka picha ya pasipoti', [photo])).toMatchObject({ op: 'passport' });
  });

  it('picks pages from one PDF', () => {
    expect(fileIntent('keep pages 1-2', [pdf])).toMatchObject({ op: 'pick_pages', pages: '1-2' });
  });

  it('joins several files into one PDF', () => {
    expect(fileIntent('combine these into one pdf', [pdf, photo])).toMatchObject({ op: 'to_pdf', fileIds: ['p1', 'i1'] });
  });

  it('checks against an upload rule', () => {
    expect(fileIntent('check this for HELB', [photo])).toMatchObject({ op: 'check_rule' });
  });

  it('leaves questions and file-less messages to the attendant', () => {
    expect(fileIntent('what does this letter say?', [pdf])).toBeNull();
    expect(fileIntent('make it under 1MB', [])).toBeNull();
    expect(fileIntent('hello', [pdf])).toBeNull();
  });
});
