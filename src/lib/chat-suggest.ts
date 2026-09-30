// Suggestion chips for the chat, chosen on the phone for free: starters for
// an empty chat (from what My Details is missing or what is due soon) and
// follow-ups under the attendant's last reply.

import { FULL_APP } from '@/data/launch';
import type { Profile } from '@/data/profile-fields';
import type { ChatAction } from '@/lib/chat-types';
import type { TextKey } from '@/lib/i18n';

// A chip either sends its words to the attendant or opens a screen.
export type Suggestion = { label: TextKey; route?: string; icon: string };

function monthsUntil(date: string) {
  const time = Date.parse(date);
  if (Number.isNaN(time)) return null;
  return (time - Date.now()) / (30.4 * 86_400_000);
}

export function starterSuggestions(profile: Profile): Suggestion[] {
  const picks: Suggestion[] = [];
  if (!profile.fullName) picks.push({ label: 'suggest.details', route: '/profile', icon: 'person-circle' });
  if (FULL_APP) {
    const passportMonths = profile.passportExpiry ? monthsUntil(profile.passportExpiry) : null;
    if (passportMonths !== null && passportMonths < 9) picks.push({ label: 'suggest.passportRenew', icon: 'airplane' });
    if (!profile.kraPin) picks.push({ label: 'suggest.kra', icon: 'receipt' });
  }
  const defaults: Suggestion[] = FULL_APP
    ? [
        { label: 'suggest.cv', icon: 'document-text' },
        { label: 'suggest.job', icon: 'briefcase' },
        { label: 'suggest.print', icon: 'print' },
        { label: 'suggest.visa', icon: 'globe' },
        { label: 'suggest.goodConduct', icon: 'shield-checkmark' },
      ]
    : [
        { label: 'suggest.cv', icon: 'document-text' },
        { label: 'suggest.job', icon: 'briefcase' },
        { label: 'suggest.passportPhoto', route: '/studio/passport', icon: 'person-circle' },
        { label: 'suggest.coverLetter', icon: 'mail' },
        { label: 'suggest.pdf', route: '/studio/photos-to-pdf', icon: 'documents' },
      ];
  for (const pick of defaults) if (picks.length < 4) picks.push(pick);
  return picks.slice(0, 4);
}

// Follow-ups that fit the reply: what it showed decides what to ask next.
export function followUps(text: string, actions: ChatAction[] = []): TextKey[] {
  const has = (type: ChatAction['type']) => actions.some((a) => a.type === type);
  const picks: TextKey[] = [];
  if (has('document')) picks.push('follow.shorter', 'follow.formal');
  if (has('open') && !has('checklist')) picks.push('follow.documents');
  if (has('open') && !has('fee')) picks.push('follow.cost');
  if (has('checklist')) picks.push('follow.where');
  if (has('fee')) picks.push('follow.pay');
  if (has('steps')) picks.push('follow.howLong');
  if (!picks.length && text.length > 0) picks.push('follow.more', 'follow.next');
  return [...new Set(picks)].slice(0, 3);
}
