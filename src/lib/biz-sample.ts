// Stand-ins for the business agent when the AI is off, and plain-rule checks
// that run on every tender.

import type { Profile } from '@/data/profile-fields';
import type { BusinessPlan, Poster, SocialPost, Tender, WriteBrief, WrittenContent, WrittenKind } from '@/lib/biz-types';
import { mergeSignals } from '@/lib/job-scam';

function sentences(text: string) {
  return text
    .split(/[\n,;.]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function samplePoster(brief: WriteBrief, profile: Profile): Poster {
  const topic = brief.topic.trim() || profile.businessNature || 'Quality products and services';
  return {
    headline: topic.length > 40 ? topic.slice(0, 40).replace(/\s+\S*$/, '') : topic,
    subheadline: profile.businessName ? `Now at ${profile.businessName}` : 'Now available near you',
    points: sentences(profile.businessNature || '').slice(0, 3),
    offer: brief.extra.trim(),
    callToAction: 'Visit us today or call to order',
  };
}

export function samplePost(brief: WriteBrief, profile: Profile): SocialPost {
  const topic = brief.topic.trim() || profile.businessNature || 'our products';
  const where = profile.businessLocation || profile.town || '';
  const phone = profile.businessPhone || profile.phone || '';
  const offer = brief.extra.trim();
  return {
    english: [`${topic}${where ? ` at ${where}` : ''}.`, offer && `${offer}.`, phone && `Call or WhatsApp ${phone}.`].filter(Boolean).join(' '),
    swahili: [`${topic}${where ? ` - tupo ${where}` : ''}.`, offer && `${offer}.`, phone && `Piga simu au WhatsApp ${phone}.`]
      .filter(Boolean)
      .join(' '),
    hashtags: [profile.town, 'Kenya', 'SmallBusiness'].filter(Boolean).map((t) => `#${String(t).replace(/\s+/g, '')}`),
  };
}

export function samplePlan(brief: WriteBrief, profile: Profile): BusinessPlan {
  const name = profile.businessName || 'My business';
  return {
    title: `${name}: business plan`,
    sections: [
      { heading: 'The business', body: profile.businessNature || 'Describe what you sell and where.' },
      { heading: 'What the money is for', body: brief.topic || 'Say what you will buy with the money.' },
      { heading: 'Amount and lender', body: brief.extra || 'Say how much you need and from whom.' },
      { heading: 'Sales, costs and customers', body: brief.details || 'Add your monthly sales, costs and main customers.' },
      {
        heading: 'Repayment',
        body: 'Explain how the extra sales will cover the monthly repayment. (Turn on the AI to have this plan written in full.)',
      },
    ],
  };
}

export function sampleWritten(kind: WrittenKind, brief: WriteBrief, profile: Profile): WrittenContent {
  if (kind === 'poster') return { kind, poster: samplePoster(brief, profile) };
  if (kind === 'post') return { kind, post: samplePost(brief, profile) };
  return { kind, plan: samplePlan(brief, profile) };
}

// ---- Tender scam check ----

const tenderRules: { pattern: RegExp; warning: string }[] = [
  {
    pattern: /\b(processing|facilitation|registration|pre-?qualification|application|commitment|booking)\s+fees?\b/i,
    warning: 'It asks for a fee to get or process the tender. Government tender documents are free to download.',
  },
  {
    pattern: /\b(send|pay|deposit)\b[^.\n]{0,40}\b(m-?pesa|to\s+07\d{2}|to\s+\+?2547)/i,
    warning: 'It asks you to send money to a phone number. Real tenders never do this.',
  },
  {
    pattern: /\b(guaranteed|assured|sure)\s+(tender|award|lpo|contract)\b/i,
    warning: 'It promises a tender will be awarded. No one can guarantee an award; this is a common con.',
  },
  {
    pattern: /\b(lpo|tender)\s+(for\s+sale|financing\s+fee|broker)\b/i,
    warning: 'It sells tenders or LPOs. Buying a tender from a middleman is illegal and often a scam.',
  },
];

const freeEmail = /@(gmail|yahoo|hotmail|outlook|ymail)\./i;

export function tenderScamSignals(tender: Tender): string[] {
  const text = [tender.title, tender.entity, tender.howToApply, ...tender.documents].join('\n');
  const found = tenderRules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.warning);
  if (freeEmail.test(text)) {
    found.push('A government tender that uses a free email like Gmail is suspicious. Check it on tenders.go.ke.');
  }
  if (tender.url && !/^https:\/\/([\w-]+\.)*(go\.ke|ac\.ke|or\.ke|co\.ke)(\/|$)/i.test(tender.url)) {
    found.push('The link is not a Kenyan official site. Confirm the tender on tenders.go.ke before you apply.');
  }
  return mergeSignals(tender.scamSignals, found);
}
