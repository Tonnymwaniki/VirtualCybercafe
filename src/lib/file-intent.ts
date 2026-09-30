// Free, instant file requests: "make this under 1MB", "600x600", "put these
// in one PDF", "pages 1-3", "for HELB". When the words are this clear the
// phone does the work itself without asking the AI. Anything else goes to
// the attendant.

import type { FileMeta, WorkRequest } from '@/lib/chat-types';

const QUESTION = /\?|\b(what|why|how|explain|read|say|says|mean|means|translate|summar|nini|soma|eleza|inasema|maana)\b/i;

function sizeLimitKB(text: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*(kb|kbs|k|mb|mbs|m)\b/i.exec(text);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  const kb = /^m/i.test(match[2]) ? Math.round(value * 1024) : Math.round(value);
  return kb >= 10 && kb <= 50 * 1024 ? kb : null;
}

function dimensions(text: string) {
  const match = /(\d{2,4})\s*(?:x|×|\*|by)\s*(\d{2,4})/i.exec(text);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width >= 16 && height >= 16 && width <= 8000 && height <= 8000 ? { width, height } : null;
}

// Upload rules people name. Photo or document is decided by the file.
function ruleFor(text: string, files: FileMeta[]): string | null {
  const photo = files.every((f) => f.kind === 'image');
  const wantsPdf = /\b(pdf|document|documents|id|certificate|cheti)\b/i.test(text);
  if (/\b(helb|hef)\b/i.test(text)) return photo && !wantsPdf ? 'hef_photo' : 'hef_docs';
  if (/\b(karatina|karu)\b/i.test(text)) return photo && !wantsPdf ? 'karu_admission_photo' : 'karu_admission_docs';
  if (/\b(ecitizen|e-citizen)\b/i.test(text) && /\b(passport|pasipoti)\b/i.test(text)) {
    return /\b(photo|picha|face|selfie)\b/i.test(text) || (photo && files.length === 1 && !/\b(id|birth|document)\b/i.test(text))
      ? 'ecitizen_passport_photo'
      : 'ecitizen_passport_docs';
  }
  return null;
}

export function fileIntent(text: string, files: FileMeta[]): WorkRequest | null {
  if (!files.length || QUESTION.test(text)) return null;
  const fileIds = files.map((f) => f.id);
  const pdfs = files.filter((f) => f.kind === 'pdf');
  const images = files.filter((f) => f.kind === 'image');
  const kb = sizeLimitKB(text);
  const dims = dimensions(text);

  if (images.length && /\bpassport\s*(?:photo|size|picture|pic)|\bpicha\s+ya\s+pasipoti\b|\bpassport\b.*\bpicha\b/i.test(text)) {
    return { op: 'passport', fileIds: [images[images.length - 1].id], printSize: /\b35\s*[x×]\s*45|\bvisa\b/i.test(text) ? 'visa' : 'kenya' };
  }

  const rule = /\b(for|check|ya|kwa)\b/i.test(text) ? ruleFor(text, files) : null;
  if (rule) return { op: 'check_rule', fileIds, ruleId: rule };

  const pages = /\b(?:pages?|kurasa|ukurasa)\s+(\d[\d,\-\s]*(?:and\s+\d+)?)/i.exec(text);
  if (pages && pdfs.length === 1 && !/\b(jpg|jpeg|picture|image|picha)\b/i.test(text)) {
    return { op: 'pick_pages', fileIds: [pdfs[0].id], pages: pages[1].replace(/\band\b/gi, ',').trim() };
  }

  if (pdfs.length && !images.length && /\b(jpg|jpeg|png|image|images|picture|pictures|photo|photos|picha)\b/i.test(text)) {
    return { op: 'to_jpg', fileIds, ...(pages ? { pages: pages[1].trim() } : {}) };
  }

  if (dims && images.length === files.length) {
    return { op: 'resize', fileIds, width: dims.width, height: dims.height, exact: true, ...(kb ? { maxKB: kb } : {}) };
  }

  if (/\b(scan|skani|clean up|cleanup|black and white)\b/i.test(text) && images.length === files.length) {
    return { op: 'scan', fileIds, look: /\bblack\b/i.test(text) ? 'bw' : 'clean' };
  }

  const joinWords = /\b(merge|combine|join|unganisha|one pdf|single pdf|into a pdf|to pdf|as pdf|as a pdf|kuwa pdf|make (?:it |them )?(?:a )?pdf)\b/i.test(text);
  if (joinWords && (files.length > 1 || images.length)) return { op: 'to_pdf', fileIds, ...(kb ? { maxKB: kb } : {}) };

  if (kb && /\b(under|less|below|smaller|reduce|compress|shrink|max|maximum|within|not more|chini|punguza|isizidi|size)\b|<|≤/i.test(text)) {
    return { op: 'shrink', fileIds, maxKB: kb };
  }
  return null;
}

// What the attendant says above a result the phone made by itself.
export function workIntro(request: WorkRequest, language: 'en' | 'sw') {
  const sw = language === 'sw';
  switch (request.op) {
    case 'shrink':
      return sw ? `Sawa, ninapunguza chini ya ${request.maxKB >= 1024 ? `${+(request.maxKB / 1024).toFixed(1)} MB` : `${request.maxKB} KB`}:` : `Sure. Making it under ${request.maxKB >= 1024 ? `${+(request.maxKB / 1024).toFixed(1)} MB` : `${request.maxKB} KB`}:`;
    case 'resize':
      return sw ? `Sawa, ninaweka ${request.width} × ${request.height}:` : `Sure. Setting it to ${request.width} × ${request.height}:`;
    case 'to_pdf':
      return sw ? 'Sawa, ninatengeneza PDF moja:' : 'Sure. Putting it into one PDF:';
    case 'pick_pages':
      return /^\d+$/.test(request.pages.trim())
        ? sw ? `Sawa, ninachukua ukurasa ${request.pages}:` : `Sure. Keeping page ${request.pages}:`
        : sw ? `Sawa, ninachukua kurasa ${request.pages}:` : `Sure. Keeping pages ${request.pages}:`;
    case 'to_jpg':
      return sw ? 'Sawa, ninageuza kuwa JPG:' : 'Sure. Turning it into JPG pictures:';
    case 'check_rule':
      return sw ? 'Ninakagua dhidi ya sheria ya kupakia:' : 'Checking it against the upload rule:';
    case 'scan':
      return sw ? 'Sawa, ninasafisha kama skana:' : 'Sure. Cleaning it up like a scanner:';
    case 'passport':
      return sw
        ? 'Sawa. Hii ni picha yako ya pasipoti kwa fomu za mtandaoni, na karatasi ya picha za kuchapisha kwenye cyber:'
        : 'Here’s your passport photo for online forms, and a sheet of print photos for any cyber:';
  }
}
