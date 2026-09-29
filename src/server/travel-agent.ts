// Claude calls behind the Travel workspace:
// - checkVisa: what a Kenyan needs to enter a country, from official sites.
// - writeLetter: cover, invitation, sponsor letters and itineraries from the
//   traveller's own details.
// - checkAgency: whether a recruitment agency is on the National Employment
//   Authority's list.

import Anthropic from '@anthropic-ai/sdk';

import type { Profile } from '@/data/profile-fields';
import {
  letterKinds,
  purposeLabel,
  type AgencyCheck,
  type AgencyStatus,
  type LetterKind,
  type Source,
  type Trip,
  type TripLetter,
  type TripPurpose,
  type VisaCheck,
  type VisaNeed,
} from '@/lib/travel-types';
import { effortOption, MODEL, modelOptions, webSearchType, WEB_CAUTION } from '@/server/model';
import { persistentCache } from '@/server/cache';
import { claude } from '@/server/claude';

export const AGENCY_SITES = ['nea.go.ke', 'labour.go.ke', 'mfa.go.ke'];

const stringList = { type: 'array', items: { type: 'string' } } as const;
const sourceList = {
  type: 'array',
  items: {
    type: 'object',
    properties: { title: { type: 'string' }, url: { type: 'string' } },
    required: ['title', 'url'],
    additionalProperties: false,
  },
} as const;

function httpsSources(sources: Source[]) {
  return sources.filter((s) => /^https:\/\//.test(s.url)).slice(0, 6);
}

type ToolLoop = { system: string; prompt: string; tool: Anthropic.Beta.BetaTool; allowedDomains?: string[] };

// Searches the web, then reads the report tool's input.
async function searchAndReport<T>({ system, prompt, tool, allowedDomains }: ToolLoop): Promise<T | null> {
  const client = claude();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }];
  for (let step = 0; step < 4; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 3000,
      ...modelOptions,
      ...(Object.keys(effortOption).length ? { output_config: effortOption } : {}),
      system: `${system} ${WEB_CAUTION}`,
      tools: [
        { type: webSearchType, name: 'web_search', max_uses: 3, ...(allowedDomains ? { allowed_domains: allowedDomains } : {}) },
        tool,
      ],
      messages,
    });
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    const report = response.content.find(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use' && block.name === tool.name,
    );
    if (report) return report.input as T;
    if (response.stop_reason === 'refusal') return null;
    messages.push({ role: 'user', content: `Please call ${tool.name} now with what you found.` });
  }
  return null;
}

// ---- Visa check ----

const VISA_CACHE_MS = 3 * 24 * 60 * 60 * 1000;
const visaCache = persistentCache<VisaCheck>('visa');
const agencyCache = persistentCache<AgencyCheck>('agency');

const needs: VisaNeed[] = ['no', 'on_arrival', 'eta', 'evisa', 'embassy', 'unknown'];

const reportVisaTool: Anthropic.Beta.BetaTool = {
  name: 'report_visa',
  description: 'Report what a Kenyan passport holder needs for this trip. Call this once, after searching.',
  input_schema: {
    type: 'object',
    properties: {
      need: { type: 'string', enum: needs },
      visaType: { type: 'string', description: 'The visa or permit name, e.g. "Schengen short-stay visa (type C)".' },
      summary: { type: 'string', description: 'Two short sentences for the traveller.' },
      documents: { ...stringList, description: 'Documents to prepare, short items.' },
      fee: { type: 'string', description: 'The fee as stated on the official site, with currency, or empty.' },
      processingTime: { type: 'string', description: 'As stated, or empty.' },
      howToApply: { type: 'string', description: 'One or two plain sentences: where and how to apply.' },
      officialUrl: { type: 'string', description: 'The official page to apply on, or empty.' },
      warnings: { ...stringList, description: 'Important cautions, e.g. apply early, fake visa sites. Usually one or two.' },
      sources: { ...sourceList, description: 'Official pages you used.' },
    },
    required: ['need', 'visaType', 'summary', 'documents', 'fee', 'processingTime', 'howToApply', 'officialUrl', 'warnings', 'sources'],
    additionalProperties: false,
  },
  strict: true,
};

export async function checkVisa(destination: string, purpose: TripPurpose): Promise<VisaCheck | null> {
  const key = `${destination.toLowerCase()}|${purpose}`;
  const cached = visaCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const today = new Date().toISOString().slice(0, 10);
  const input = await searchAndReport<Omit<VisaCheck, 'checkedAt' | 'mode'>>({
    system: `You check entry requirements for Kenyan passport holders, for the Virtual Cybercafe app. Today is ${today}. Use only official sources: the destination's government, immigration service or embassy, its official visa centre (such as VFS Global or TLScontact), or Kenya's Ministry of Foreign Affairs. Ignore visa agents and blogs. If official sources disagree or are unclear, say "unknown" and point to the official site.`,
    prompt: `A Kenyan citizen is going to ${destination} for: ${purposeLabel[purpose]}. What do they need to enter? Then call report_visa.`,
    tool: reportVisaTool,
  });
  if (!input) return null;
  const value: VisaCheck = {
    ...input,
    officialUrl: /^https:\/\//.test(input.officialUrl) ? input.officialUrl : '',
    sources: httpsSources(input.sources),
    checkedAt: new Date().toISOString(),
    mode: 'ai',
  };
  visaCache.set(key, { value, expires: Date.now() + VISA_CACHE_MS });
  return value;
}

// ---- Letters ----

const letterSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'body'],
  properties: {
    title: { type: 'string' },
    body: {
      type: 'string',
      description: 'The full letter or itinerary as plain text, with blank lines between paragraphs. Put ________ where a detail is missing.',
    },
  },
} as const;

const letterInstructions: Record<LetterKind, string> = {
  cover: 'Write a formal cover letter from the traveller to the visa officer: who they are, the purpose and dates of the trip, who pays, and their ties to Kenya (job, family, studies) that show they will return.',
  invitation: 'Write a formal invitation letter from the user (the host in Kenya) inviting the visitor described in the notes: relationship, dates, where the visitor will stay and who pays.',
  sponsor: 'Write a formal sponsorship letter from the sponsor described in the notes, confirming they will pay for the traveller\'s trip, with the relationship and what they will cover. Leave a line for the sponsor\'s signature.',
  itinerary: 'Write a clear day-by-day travel itinerary from the notes: flights, cities and where the traveller will stay. Use only what the notes say; mark gaps with ________.',
};

function travellerText(profile: Profile) {
  const keys = [
    'fullName', 'idNumber', 'dateOfBirth', 'passportNumber', 'passportExpiry', 'nationality', 'phone', 'email',
    'postalAddress', 'town', 'occupation', 'employer',
  ];
  return keys.filter((k) => profile[k]).map((k) => `${k}: ${profile[k]}`).join('\n') || '(nothing saved)';
}

export async function writeLetter(kind: LetterKind, trip: Trip, profile: Profile, notes: string): Promise<TripLetter | null> {
  const client = claude();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2500,
    ...modelOptions,
    output_config: { ...effortOption, format: { type: 'json_schema', schema: letterSchema } },
    system: `You write travel documents for Kenyans, for the Virtual Cybercafe app. ${letterInstructions[kind]} Today is ${new Date().toISOString().slice(0, 10)}. Use only the facts given. Never invent names, passport numbers, bank balances, bookings or addresses; put ________ where something is missing.`,
    messages: [
      {
        role: 'user',
        content: `Document: ${letterKinds[kind].label}
Trip: ${purposeLabel[trip.purpose]} to ${trip.destination}, from ${trip.departDate || '(date not set)'} to ${trip.returnDate || '(date not set)'}
Traveller (the user):
${travellerText(profile)}
Notes from the user: ${notes || '(none)'}`,
      },
    ],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const data = JSON.parse(text) as { title: string; body: string };
  return { ...data, writtenAt: new Date().toISOString(), mode: 'ai' };
}

// ---- Recruitment agency check ----

const statuses: AgencyStatus[] = ['listed', 'not_listed', 'revoked', 'unclear'];

const reportAgencyTool: Anthropic.Beta.BetaTool = {
  name: 'report_agency',
  description: 'Report whether the agency is on the official list. Call this once, after searching.',
  input_schema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: statuses,
        description: 'listed: on the current accredited list. revoked: suspended, deregistered or on a warning list. not_listed: the list was found and the agency is not on it. unclear: could not tell.',
      },
      name: { type: 'string', description: 'The agency name as it appears on the list, or as given.' },
      detail: { type: 'string', description: 'Two short sentences: what the list shows and what to do next.' },
      sources: { ...sourceList, description: 'Official pages you used.' },
    },
    required: ['status', 'name', 'detail', 'sources'],
    additionalProperties: false,
  },
  strict: true,
};

export async function checkAgency(name: string): Promise<AgencyCheck | null> {
  const key = name.toLowerCase();
  const cached = agencyCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const input = await searchAndReport<Omit<AgencyCheck, 'mode'>>({
    system: `You help Kenyans avoid fake overseas job agents, for the Virtual Cybercafe app. Search the National Employment Authority (NEA) and Ministry of Labour sites for the list of accredited private employment agencies, and any list of suspended or deregistered agencies. Report only what the official pages show. Similar names are not a match; say so.`,
    prompt: `Is this recruitment agency accredited to send Kenyans to work abroad: "${name}"? Then call report_agency.`,
    tool: reportAgencyTool,
    allowedDomains: AGENCY_SITES,
  });
  if (!input) return null;
  const value: AgencyCheck = { ...input, sources: httpsSources(input.sources), mode: 'ai' };
  agencyCache.set(key, { value, expires: Date.now() + 24 * 60 * 60 * 1000 });
  return value;
}
