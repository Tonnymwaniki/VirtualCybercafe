// Checks form answers before the user types them into eCitizen or iTax.
// These are plain rules, so they cost nothing to run.

import type { FormField } from '@/data/gov-tasks';
import { normaliseKenyanPhone } from '@/lib/phone';

export type Issue = { key: string; message: string };

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${value.trim()}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.trim() ? null : date;
}

function nameWords(value: string) {
  return value.toUpperCase().split(/\s+/).filter(Boolean);
}

export function validateAnswers(fields: FormField[], answers: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  for (const field of fields) {
    const value = (answers[field.key] ?? '').trim();
    if (!value) {
      if (!field.optional) issues.push({ key: field.key, message: `${field.label} is empty.` });
      continue;
    }
    switch (field.kind) {
      case 'idNumber':
        if (!/^\d{7,9}$/.test(value.replace(/\s/g, ''))) {
          issues.push({ key: field.key, message: `${field.label} should be 7 to 9 digits, with no letters.` });
        }
        break;
      case 'kraPin':
        if (!/^[AP]\d{9}[A-Z]$/i.test(value)) {
          issues.push({ key: field.key, message: `${field.label} should look like A123456789B.` });
        }
        break;
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          issues.push({ key: field.key, message: `${field.label} doesn’t look like an email address.` });
        }
        break;
      case 'phone':
        if (!normaliseKenyanPhone(value)) {
          issues.push({ key: field.key, message: `${field.label} should be a Kenyan number like 0712 345 678.` });
        }
        break;
      case 'date': {
        const date = parseDate(value);
        if (!date) {
          issues.push({ key: field.key, message: `${field.label} should be written as YYYY-MM-DD, e.g. 1998-04-21.` });
        } else if (date.getTime() > Date.now()) {
          issues.push({ key: field.key, message: `${field.label} is in the future.` });
        } else if (field.key === 'dateOfBirth') {
          const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
          if (age < 18) issues.push({ key: field.key, message: 'You need to be 18 or older for this service.' });
        }
        break;
      }
    }
  }

  const fullName = answers.fullName?.trim();
  if (fullName && nameWords(fullName).length < 2) {
    issues.push({ key: 'fullName', message: 'Write your full name exactly as it appears on your ID (at least two names).' });
  }
  if (answers.recommenderId && answers.idNumber && answers.recommenderId.trim() === answers.idNumber.trim()) {
    issues.push({ key: 'recommenderId', message: 'Your recommender must be someone else, not you.' });
  }
  return issues;
}
