// The document pipeline of Form Intelligence: when a file is attached, look
// at the real file (not its name), measure it, compare it with what the form
// needs, and fix what the phone safely can.
//
//   attach → inspect (real type from the bytes) → size → pixels → pages
//          → compare with the field's rule → plain result → Fix automatically

import type { useEngine } from '@/components/workbench/engine';
import type { Preset } from '@/data/presets';
import { sizeText } from '@/lib/forms/reason';
import type { DocType, FileFacts, FormField, FormFile } from '@/lib/forms/schema';
import { imageSize } from '@/lib/workbench/image';
import { pageCount, WorkbenchError } from '@/lib/workbench/pdf';
import type { WorkFile } from '@/lib/workbench/files';
import { fixToRule } from '@/lib/workbench/validate';

const NAMES: Record<DocType, string> = { pdf: 'PDF', jpg: 'JPG', png: 'PNG', doc: 'DOC', docx: 'DOCX', other: 'another type' };

// "PDF, DOCX or DOC"
function listTypes(types: DocType[]) {
  const names = types.map((t) => NAMES[t]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
}

export const typeName = (type: DocType) => NAMES[type];

// What the file really is, from its first bytes; the name can lie.
export function sniffType(bytes: Uint8Array, name = ''): DocType {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'doc';
  // DOCX is a zip; trust the name to tell it from other zips.
  if (b[0] === 0x50 && b[1] === 0x4b && /\.docx$/i.test(name)) return 'docx';
  return 'other';
}

// Measures the file. A locked or damaged PDF still gets facts, with a flag.
export async function inspect(file: WorkFile): Promise<FileFacts> {
  const type = sniffType(file.bytes, file.name);
  const facts: FileFacts = { type, bytes: file.bytes.byteLength };
  try {
    if (type === 'pdf') facts.pages = await pageCount({ ...file, kind: 'pdf' });
    if (type === 'jpg' || type === 'png') {
      const { width, height } = await imageSize(file);
      facts.width = width;
      facts.height = height;
    }
  } catch (error) {
    if (error instanceof WorkbenchError && error.kind === 'pdf_locked') facts.locked = true;
    else facts.unreadable = true;
  }
  return facts;
}

export type DocProblem = {
  // What is wrong, in plain words.
  what: string;
  required: string;
  yours: string;
  // Whether Fix automatically can solve it.
  fixable: boolean;
};

// The file's type from its name, for files attached before they were measured.
function typeFromName(name: string): DocType {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jpeg' || ext === 'jpg') return 'jpg';
  return (['pdf', 'png', 'doc', 'docx'].includes(ext) ? ext : 'other') as DocType;
}

// Compares a file with what the field needs. `limitKB` is the size limit the
// portal states, when the person set one for this application.
export function documentProblems(field: FormField, file: FormFile, limitKB?: number): DocProblem[] {
  const rule = field.document;
  const facts = file.facts;
  const type = facts?.type ?? typeFromName(file.name);
  const bytes = facts?.bytes ?? file.bytes;
  const problems: DocProblem[] = [];
  const canMake = (t: DocType) => t === 'pdf' || t === 'jpg' || t === 'png';

  if (facts?.locked) {
    problems.push({ what: `${field.label} is locked with a password, so the employer can’t open it.`, required: 'A PDF without a password', yours: 'Locked PDF', fixable: false });
  }
  if (facts?.unreadable) {
    problems.push({ what: `${field.label} couldn’t be opened. It may be damaged or only partly downloaded.`, required: 'A file that opens', yours: 'Damaged file', fixable: false });
  }
  if (rule?.types.length && !rule.types.includes(type as never)) {
    const fixable = canMake(type) && rule.types.some(canMake);
    problems.push({
      what: `${field.label} is the wrong type of file.`,
      required: listTypes(rule.types),
      yours: NAMES[type],
      fixable,
    });
  }
  const maxKB = Math.min(rule?.maxKB ?? Infinity, limitKB ?? Infinity);
  if (Number.isFinite(maxKB) && bytes > maxKB * 1024) {
    problems.push({
      what: `${field.label} is too large.`,
      required: `Up to ${sizeText(maxKB * 1024)}`,
      yours: sizeText(bytes),
      fixable: canMake(type),
    });
  }
  if (rule?.maxPages && facts?.pages && facts.pages > rule.maxPages) {
    problems.push({ what: `${field.label} has too many pages.`, required: `Up to ${rule.maxPages} pages`, yours: `${facts.pages} pages`, fixable: false });
  }
  return problems;
}

// The field's rule as an upload preset, so the Workbench fixer can use it.
export function presetFor(field: FormField, limitKB?: number): Preset {
  const rule = field.document;
  const types = (rule?.types ?? ['pdf']).filter((t): t is 'pdf' | 'jpg' | 'png' => t === 'pdf' || t === 'jpg' || t === 'png');
  const maxKB = Math.min(rule?.maxKB ?? Infinity, limitKB ?? Infinity);
  return {
    id: field.id.replace(/File$/, '').toLowerCase(),
    title: field.label,
    where: field.label,
    types: types.length ? types : ['pdf'],
    maxKB: Number.isFinite(maxKB) ? maxKB : undefined,
    maxPages: rule?.maxPages,
  };
}

export async function fixDocument(field: FormField, file: WorkFile, engine: ReturnType<typeof useEngine>, limitKB?: number) {
  const result = await fixToRule(file, presetFor(field, limitKB), engine);
  return { ...result, facts: await inspect(result.file) };
}
