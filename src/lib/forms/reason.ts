// The form's reasoning: runs a schema's rules on an entry, on the phone and
// for free. It says, for every field, whether it passes and why not; how
// ready each section and the whole form are; the one next thing to do; and
// what would likely get the application turned down.

import { normaliseKenyanPhone } from '@/lib/phone';
import { allFields, isFileField, isVisible, type FormEntry, type FormField, type FormSchema, type Rule } from '@/lib/forms/schema';

export type FieldStatus = 'ok' | 'missing' | 'invalid' | 'empty';

export type FieldResult = { status: FieldStatus; message?: string; warning?: string };

export type SectionResult = {
  id: string;
  title: string;
  done: number;
  total: number;
  missing: number;
  invalid: number;
};

export type Risk = { fieldId?: string; message: string };

export type Reasoning = {
  fields: Record<string, FieldResult>;
  sections: SectionResult[];
  percent: number;
  ready: boolean;
  // The one next thing to do, in order of the form.
  next?: { fieldId: string; sectionId: string; message: string };
  // Things that would likely get it turned down, even when every field is filled.
  risks: Risk[];
};

const DAY = 24 * 3600 * 1000;

export function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${value.trim()}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.trim() ? null : date;
}

function ageOn(date: Date, now: Date) {
  return (now.getTime() - date.getTime()) / (365.25 * DAY);
}

// The first rule the value breaks, as a sentence, or null.
export function breaks(rule: Rule, value: string, label: string, now: Date): string | null {
  const v = value.trim();
  switch (rule.kind) {
    case 'pattern':
      return new RegExp(rule.pattern, 'i').test(v) ? null : rule.message;
    case 'minLength':
      return v.length >= rule.value ? null : rule.message;
    case 'maxLength':
      return v.length <= rule.value ? null : rule.message;
    case 'min':
      return Number(v) >= rule.value ? null : rule.message;
    case 'max':
      return Number(v) <= rule.value ? null : rule.message;
    case 'idNumber':
      return /^\d{6,9}$/.test(v.replace(/\s/g, '')) ? null : `${label} should be 6 to 9 digits (the new Maisha Namba has 9), with no letters.`;
    case 'kraPin':
      return /^[AP]\d{9}[A-Z]$/i.test(v) ? null : `${label} should look like A123456789B: a letter, 9 digits, then a letter.`;
    case 'kenyanPhone':
      return normaliseKenyanPhone(v) ? null : `${label} should be a Kenyan number like 0712 345 678.`;
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : `${label} doesn’t look like an email address (like name@gmail.com).`;
    case 'pastDate': {
      const date = parseDate(v);
      if (!date) return `${label} should be a date written as YYYY-MM-DD, for example 1998-04-21.`;
      return date.getTime() > now.getTime() ? `${label} is in the future.` : null;
    }
    case 'minAge': {
      const date = parseDate(v);
      return date && ageOn(date, now) < rule.value ? `You need to be at least ${rule.value} years old for this.` : null;
    }
    case 'maxAge': {
      const date = parseDate(v);
      return date && ageOn(date, now) > rule.value ? `That makes you over ${rule.value}. Check the year.` : null;
    }
    case 'fullName':
      return v.split(/\s+/).filter(Boolean).length >= 2 ? null : 'Write your full name exactly as on your ID, at least two names.';
    case 'words':
      return v.split(/\s+/).filter(Boolean).length >= rule.min ? null : rule.message;
  }
}

// Rules every field of a type gets without saying so.
function typeRules(field: FormField): Rule[] {
  switch (field.type) {
    case 'phone':
      return [{ kind: 'kenyanPhone' }];
    case 'email':
      return [{ kind: 'email' }];
    case 'date':
      return [{ kind: 'pastDate' }];
    case 'number':
      return [{ kind: 'pattern', pattern: '^-?\\d+(\\.\\d+)?$', message: `${field.label} should be a number.` }];
    default:
      return [];
  }
}

export function checkField(field: FormField, entry: Pick<FormEntry, 'answers' | 'files'>, now = new Date()): FieldResult {
  if (isFileField(field)) {
    const file = entry.files[field.id];
    if (!file) return { status: field.required ? 'missing' : 'empty', message: field.required ? `${field.label} is missing.` : undefined };
    const rule = field.document;
    if (rule?.maxKB && file.bytes > rule.maxKB * 1024) {
      return {
        status: 'invalid',
        message: `${field.label} is too large. Allowed: up to ${sizeText(rule.maxKB * 1024)}. Yours: ${sizeText(file.bytes)}.`,
      };
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const type = ext === 'jpeg' ? 'jpg' : ext;
    if (rule?.types.length && !rule.types.includes(type as never)) {
      return { status: 'invalid', message: `${field.label} must be ${rule.types.map((t) => t.toUpperCase()).join(' or ')}. Yours is ${type.toUpperCase() || 'another type'}.` };
    }
    return { status: 'ok' };
  }
  const value = (entry.answers[field.id] ?? '').trim();
  if (!value || (field.type === 'checkbox' && value !== 'yes')) {
    if (!field.required) return { status: 'empty' };
    return { status: 'missing', message: field.type === 'checkbox' ? `Tick “${field.label}” to continue.` : `${field.label} is empty.` };
  }
  if (field.options?.length && !field.options.some((o) => o.value === value)) {
    return { status: 'invalid', message: `Choose one of the options for ${field.label}.` };
  }
  for (const rule of [...typeRules(field), ...(field.rules ?? [])]) {
    const problem = breaks(rule, value, field.label, now);
    if (problem) return { status: 'invalid', message: problem };
  }
  if (field.knockout && value !== field.knockout.expect) return { status: 'ok', warning: field.knockout.message };
  return { status: 'ok' };
}

export function sizeText(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function reasonAbout(schema: FormSchema, entry: FormEntry, now = new Date()): Reasoning {
  const fields: Record<string, FieldResult> = {};
  const risks: Risk[] = [];

  for (const field of allFields(schema)) {
    if (isVisible(field, entry.answers)) fields[field.id] = checkField(field, entry, now);
  }

  for (const cross of schema.crossChecks ?? []) {
    if (cross.kind === 'dateOrder') {
      const before = parseDate(entry.answers[cross.before] ?? '');
      const after = parseDate(entry.answers[cross.after] ?? '');
      if (before && after && after.getTime() < before.getTime() && fields[cross.after]) {
        fields[cross.after] = { status: 'invalid', message: cross.message };
      }
    }
    if (cross.kind === 'differs') {
      const a = (entry.answers[cross.a] ?? '').trim().toLowerCase();
      const b = (entry.answers[cross.b] ?? '').trim().toLowerCase();
      if (a && a === b && fields[cross.b]) fields[cross.b] = { status: 'invalid', message: cross.message };
    }
    if (cross.kind === 'deadline' && entry.deadline) {
      const deadline = parseDate(entry.deadline);
      if (!deadline) continue;
      if (deadline.getTime() + DAY < now.getTime()) risks.push({ message: cross.message });
      else if (deadline.getTime() - now.getTime() < 3 * DAY) {
        risks.push({ message: `The deadline is ${entry.deadline}. Submit on the official site before then; portals stop taking applications at closing time.` });
      }
    }
  }

  let next: Reasoning['next'];
  const sections = schema.sections.map((section) => {
    const result: SectionResult = { id: section.id, title: section.title, done: 0, total: 0, missing: 0, invalid: 0 };
    for (const field of section.fields) {
      const check = fields[field.id];
      if (!check) continue;
      if (check.warning) risks.push({ fieldId: field.id, message: check.warning });
      // Counted: required fields, and optional ones filled in wrongly.
      if (!field.required && check.status !== 'invalid') continue;
      result.total += 1;
      if (check.status === 'ok') result.done += 1;
      if (check.status === 'missing') result.missing += 1;
      if (check.status === 'invalid') result.invalid += 1;
      if (!next && check.status !== 'ok') next = { fieldId: field.id, sectionId: section.id, message: check.message ?? field.label };
    }
    return result;
  });

  const total = sections.reduce((sum, s) => sum + s.total, 0);
  const done = sections.reduce((sum, s) => sum + s.done, 0);
  const ready = !next;
  // Never 100% until everything passes.
  const percent = ready ? 100 : Math.min(99, Math.round((done / Math.max(1, total)) * 100));
  return { fields, sections, percent, ready, next, risks };
}
