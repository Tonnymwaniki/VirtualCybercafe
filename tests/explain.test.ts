import { ApiError } from '@/lib/api';
import { failureText } from '@/lib/failure';
import { translate } from '@/lib/i18n';
import { errorKind, explainedText, explainError, isHeic } from '@/lib/workbench/explain';
import type { WorkFile } from '@/lib/workbench/files';
import { WorkbenchError } from '@/lib/workbench/pdf';

jest.mock('@/lib/stats', () => ({ reportError: jest.fn(), track: jest.fn() }));

const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate('en', key, vars);
const photo = (name: string, bytes: Uint8Array, extra: Partial<WorkFile> = {}): WorkFile => ({ name, kind: 'image', mimeType: 'image/jpeg', bytes, ...extra });
const heicBytes = new Uint8Array([0, 0, 0, 0x18, ...Array.from('ftypheic', (c) => c.charCodeAt(0)), 0, 0]);

describe('explainError', () => {
  it('spots iPhone HEIC photos by name or by their bytes', () => {
    expect(isHeic(photo('IMG_1.HEIC', new Uint8Array(4)))).toBe(true);
    expect(isHeic(photo('photo.jpg', heicBytes))).toBe(true);
    expect(isHeic(photo('photo.jpg', new Uint8Array(20)))).toBe(false);
    expect(errorKind(new Error('decode failed'), [photo('photo.jpg', heicBytes)])).toBe('heic');
  });

  it('explains a picture that failed to load, even without a message', () => {
    const out = explainError({}, 'resize', t, [photo('a.jpg', new Uint8Array(10))]);
    expect(out.kind).toBe('decode');
    expect(out.title).toBe('We couldn’t resize this photo');
    expect(out.steps.length).toBeGreaterThan(1);
    expect(out.detail).toContain('without a message');
  });

  it('says a huge photo ran out of memory, with its size', () => {
    const big = photo('big.jpg', new Uint8Array(10), { width: 9000, height: 6000 });
    const out = explainError(new RangeError('Array buffer allocation failed'), 'resize', t, [big]);
    expect(out.kind).toBe('too_big');
    expect(out.why).toContain('54 megapixels');
  });

  it('keeps the plain words of a locked PDF', () => {
    const out = explainError(new WorkbenchError('a.pdf is locked with a password.', 'pdf_locked'), 'shrinkPdf', t);
    expect(out.why).toBe('a.pdf is locked with a password.');
    expect(out.steps[0]).toMatch(/password/);
  });

  it('reads server answers', () => {
    expect(errorKind(new ApiError(429, 'Today’s AI limit is reached.', true))).toBe('limit');
    expect(errorKind(new ApiError(503, 'HTTP 503'))).toBe('server');
    expect(errorKind(new TypeError('Failed to fetch'))).toBe('network');
    expect(explainedText(explainError(new ApiError(401, 'x'), 'cvImport', t))).toMatch(/^We couldn’t read your old CV\. You need to be signed in/);
  });
});

describe('failureText', () => {
  it('says why a service request failed', () => {
    expect(failureText('Couldn’t search right now.', new TypeError('Failed to fetch'))).toMatch(/connected to the internet\. Turn on/);
    expect(failureText('Couldn’t search.', new ApiError(500, 'HTTP 500'))).toContain('error 500');
    expect(failureText('Couldn’t search.', new ApiError(429, 'Today’s AI limit is reached.', true))).toContain('Today’s AI limit is reached.');
  });
});
