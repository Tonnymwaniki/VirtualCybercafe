// Whether an owner can bid for a tender reserved under AGPO.

import { tenderGroupLabel, type Tender } from '@/lib/biz-types';

export type Eligibility = { tone: 'good' | 'warn' | 'info'; text: string; needsAgpo: boolean };

function groupOf(category: string): Tender['group'] | null {
  const c = category.toLowerCase();
  if (/youth|vijana/.test(c)) return 'youth';
  if (/wom[ae]n|female|wanawake/.test(c)) return 'women';
  if (/pwd|disab|ulemavu/.test(c)) return 'pwd';
  return null;
}

export function eligibility(tender: Tender, agpoCategory: string): Eligibility {
  if (tender.group === 'open') return { tone: 'info', text: 'Open to all registered businesses.', needsAgpo: false };
  const mine = groupOf(agpoCategory);
  if (!mine) {
    return {
      tone: 'warn',
      text: `${tenderGroupLabel[tender.group]}. You need an AGPO certificate to bid.`,
      needsAgpo: true,
    };
  }
  if (tender.group === 'agpo' || tender.group === mine) {
    return { tone: 'good', text: 'Reserved for your AGPO group. Attach your AGPO certificate.', needsAgpo: false };
  }
  return {
    tone: 'warn',
    text: `${tenderGroupLabel[tender.group]}, but your AGPO certificate is for ${agpoCategory}.`,
    needsAgpo: false,
  };
}
