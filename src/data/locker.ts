// Locker folders. Each is a folder in the private storage bucket:
// <userId>/<category>/<timestamp>-<name>.
import type { Translate } from '@/lib/i18n';

export type LockerCategory = 'CV' | 'ID' | 'Certificates' | 'Photos' | 'Documents';

// A folder's name in the chosen language, e.g. "CV & letters" / "CV na barua".
export function lockerLabel(t: Translate, category: LockerCategory) {
  return t(`locker.folder.${category}`);
}

export const lockerCategories: LockerCategory[] = ['CV', 'ID', 'Certificates', 'Photos', 'Documents'];

export const lockerFilters: ('All' | LockerCategory)[] = ['All', ...lockerCategories];

// A first guess at the folder from the file's name, when the person didn't
// pick one. They can move it later.
export function guessCategory(name: string, mimeType: string): LockerCategory {
  const text = name.toLowerCase().replace(/[_\-.]+/g, ' ');
  if (/\b(cv|resume|r[eé]sum[eé]|cover letter|application letter|barua)\b/.test(text)) return 'CV';
  if (/\b(id|national id|kitambulisho|passport|pasipoti|huduma|birth cert\w*)\b/.test(text)) return 'ID';
  if (/\b(cert\w*|kcse|kcpe|transcript|diploma|degree|good conduct|kra pin|result slip|testimonial)\b/.test(text)) return 'Certificates';
  if (mimeType.startsWith('image/')) return 'Photos';
  return 'Documents';
}
