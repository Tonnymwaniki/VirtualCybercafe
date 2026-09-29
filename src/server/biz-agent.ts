// Claude calls behind the Business workspace:
// - writeDoc: writes a poster, a social media post or a business plan from
//   the owner's own answers and saved business details.
// - findTenders: searches official tender sites for open tenders that fit.
// Every tender is checked for scam signs with plain rules as well.

import Anthropic from '@anthropic-ai/sdk';

import type { Profile } from '@/data/profile-fields';
import { tenderScamSignals } from '@/lib/biz-sample';
import type { Tender, TenderGroup, TenderSearch, WriteBrief, WrittenContent, WrittenKind } from '@/lib/biz-types';
import { effortOption, MODEL, modelOptions, webSearchType, WEB_CAUTION } from '@/server/model';
import { persistentCache } from '@/server/cache';
import { claude } from '@/server/claude';

// tenders.go.ke (the Public Procurement Information Portal) is where public
// bodies must publish their tenders.
export const TENDER_SITES = ['tenders.go.ke', 'ppra.go.ke', 'agpo.go.ke', 'treasury.go.ke'];

const HONESTY = `Use only facts from the owner's answers and saved details. Never invent sales figures, prices, customers, awards, licences or contact details. Where a number is missing, write the section without it rather than guessing.`;

const stringList = { type: 'array', items: { type: 'string' } } as const;

const schemas: Record<WrittenKind, Record<string, unknown>> = {
  poster: {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'subheadline', 'points', 'offer', 'callToAction'],
    properties: {
      headline: { type: 'string', description: 'Up to 6 words, big and clear.' },
      subheadline: { type: 'string', description: 'One short line.' },
      points: { ...stringList, description: 'Two to four short selling points.' },
      offer: { type: 'string', description: 'The offer exactly as the owner gave it, or empty.' },
      callToAction: { type: 'string', description: 'Short, e.g. "Call or WhatsApp to order".' },
    },
  },
  post: {
    type: 'object',
    additionalProperties: false,
    required: ['english', 'swahili', 'hashtags'],
    properties: {
      english: { type: 'string', description: 'A friendly post, 2 to 4 sentences, with the contact at the end.' },
      swahili: { type: 'string', description: 'The same post in natural Kenyan Swahili.' },
      hashtags: { ...stringList, description: 'Three to five hashtags, each starting with #.' },
    },
  },
  plan: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'sections'],
    properties: {
      title: { type: 'string' },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['heading', 'body'],
          properties: { heading: { type: 'string' }, body: { type: 'string' } },
        },
        description:
          'In order: Summary; The business; Customers and market; Competition; Marketing; Operations; The loan and how it will be used; Sales and costs; How the loan will be repaid; Risks and what we will do.',
      },
    },
  },
};

const instructions: Record<WrittenKind, string> = {
  poster: 'Write the words for a printed A4 poster or flyer. Short, punchy, easy to read from a distance.',
  post: 'Write a social media post for WhatsApp status, Facebook or Instagram, in English and in Swahili.',
  plan: 'Write a simple, honest business plan that a Hustler Fund officer, a bank or a SACCO can read in five minutes. Plain words, short paragraphs. In "Sales and costs" and "How the loan will be repaid", show the arithmetic from the owner\'s own figures.',
};

function businessText(profile: Profile) {
  const keys = ['businessName', 'businessNature', 'businessLocation', 'town', 'county', 'businessPhone', 'phone', 'mpesaTill', 'businessRegNo'];
  return keys.filter((k) => profile[k]).map((k) => `${k}: ${profile[k]}`).join('\n') || '(no business details saved)';
}

function briefText(kind: WrittenKind, brief: WriteBrief) {
  if (kind === 'plan') {
    return `What the money is for: ${brief.topic || '(not given)'}
Amount needed and lender: ${brief.extra || '(not given)'}
Sales, costs, customers and competitors, in the owner's words: ${brief.details || '(not given)'}`;
  }
  return `What to advertise: ${brief.topic || '(not given)'}
Offer or price to mention: ${brief.extra || '(none)'}`;
}

export async function writeDoc(kind: WrittenKind, brief: WriteBrief, profile: Profile): Promise<WrittenContent | null> {
  const client = claude();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: kind === 'plan' ? 6000 : 1500,
    ...modelOptions,
    output_config: { ...effortOption, format: { type: 'json_schema', schema: schemas[kind] } },
    system: `You write for small businesses in Kenya, for the Virtual Cybercafe app. ${instructions[kind]} ${HONESTY}`,
    messages: [{ role: 'user', content: `Saved business details:\n${businessText(profile)}\n\n${briefText(kind, brief)}` }],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const data = JSON.parse(text);
  if (kind === 'poster') return { kind, poster: data };
  if (kind === 'post') return { kind, post: data };
  return { kind, plan: data };
}

// ---- Tenders ----

const TENDER_CACHE_MS = 12 * 60 * 60 * 1000;
const tenderCache = persistentCache<TenderSearch>('tenders');

const groups: TenderGroup[] = ['open', 'youth', 'women', 'pwd', 'agpo'];

const reportTendersTool: Anthropic.Beta.BetaTool = {
  name: 'report_tenders',
  description: 'Report the open tenders you found. Call this once, after searching.',
  input_schema: {
    type: 'object',
    properties: {
      tenders: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            entity: { type: 'string', description: 'The ministry, county, agency or school advertising it.' },
            reference: { type: 'string', description: 'Tender number, or empty.' },
            closingDate: { type: 'string', description: 'Closing date as YYYY-MM-DD, or empty if not stated.' },
            closingText: { type: 'string', description: 'Closing date and time as written, or empty.' },
            group: { type: 'string', enum: groups, description: 'open, or who the tender is reserved for.' },
            documents: { ...stringList, description: 'Documents bidders must submit, short items, if the page lists them.' },
            howToApply: { type: 'string', description: 'One or two plain sentences: where to get the documents and how to submit.' },
            url: { type: 'string', description: 'The official page for this tender.' },
            whyItFits: { type: 'string', description: 'One short line on why it suits this business.' },
            scamSignals: { ...stringList, description: 'Plain warnings if anything looks fake or asks for fees. Usually empty.' },
          },
          required: ['title', 'entity', 'reference', 'closingDate', 'closingText', 'group', 'documents', 'howToApply', 'url', 'whyItFits', 'scamSignals'],
          additionalProperties: false,
        },
      },
      note: { type: 'string', description: 'One short line for the owner, e.g. where else to look. Empty if nothing to add.' },
    },
    required: ['tenders', 'note'],
    additionalProperties: false,
  },
  strict: true,
};

export async function findTenders(query: string, county: string, agpoCategory: string): Promise<TenderSearch> {
  const key = `${query.toLowerCase()}|${county.toLowerCase()}|${agpoCategory.toLowerCase()}`;
  const cached = tenderCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const client = claude();
  const today = new Date().toISOString().slice(0, 10);
  const agpo = agpoCategory
    ? `The business holds an AGPO certificate for ${agpoCategory}; include tenders reserved for that group and open tenders.`
    : 'The business has no AGPO certificate; prefer open tenders, and mark reserved ones clearly.';
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `Find open public tenders in Kenya for a small business that does: ${query}${county ? `, in or near ${county} County` : ''}. ${agpo} Then call report_tenders with up to 8 tenders whose closing date has not passed.`,
    },
  ];
  for (let step = 0; step < 4; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      ...modelOptions,
      ...(Object.keys(effortOption).length ? { output_config: effortOption } : {}),
      system: `You find public tenders for small businesses in Kenya. Today is ${today}. Search the official tender sites only. Report only real tenders you saw in the results, with the link to each. Skip anything that asks bidders to pay a fee to a person or promises an award. ${WEB_CAUTION}`,
      tools: [{ type: webSearchType, name: 'web_search', max_uses: 3, allowed_domains: TENDER_SITES }, reportTendersTool],
      messages,
    });
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    const report = response.content.find(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use' && block.name === 'report_tenders',
    );
    if (report) {
      const input = report.input as { tenders: Tender[]; note: string };
      const value: TenderSearch = {
        tenders: input.tenders
          .filter((t) => /^https:\/\//.test(t.url))
          .slice(0, 8)
          .map((t) => ({
            ...t,
            closingDate: /^\d{4}-\d{2}-\d{2}$/.test(t.closingDate) ? t.closingDate : '',
            scamSignals: tenderScamSignals(t),
          })),
        note: input.note,
        mode: 'ai',
      };
      tenderCache.set(key, { value, expires: Date.now() + TENDER_CACHE_MS });
      return value;
    }
    if (response.stop_reason === 'refusal') break;
    messages.push({ role: 'user', content: 'Please call report_tenders now with what you found.' });
  }
  return { tenders: [], note: 'No open tenders found right now. Try a broader description, or check tenders.go.ke.', mode: 'ai' };
}
