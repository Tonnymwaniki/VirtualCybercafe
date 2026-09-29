// Claude calls behind the Government Services workspace:
// - checkRequirements: searches the official sites for a task's current
//   requirements and fee, then reports them through a strict tool.
// - readIdPhoto: reads the details off a photo of a Kenyan ID.

import Anthropic from '@anthropic-ai/sdk';

import type { GovTask } from '@/data/gov-tasks';
import type { IdDetails, IdReadResult, RequirementsCheck } from '@/lib/gov-types';
import { effortOption, MODEL, modelOptions, webSearchType } from '@/server/model';
import { persistentCache } from '@/server/cache';
import { claude } from '@/server/claude';

const MAX_STEPS = 5;
// Requirements and fees rarely change within days; reuse a check to save cost.
const CACHE_MS = 3 * 24 * 60 * 60 * 1000;
const cache = persistentCache<RequirementsCheck>('gov-requirements');

const reportTool: Anthropic.Beta.BetaTool = {
  name: 'report_requirements',
  description: 'Report the current requirements, fee and steps for the task. Call this once, after searching.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'What the applicant needs, one short item each.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            note: { type: 'string', description: 'Short extra detail, or empty.' },
          },
          required: ['label', 'note'],
          additionalProperties: false,
        },
      },
      fee: {
        type: 'string',
        description: 'The fee in KSh exactly as stated on the official source, e.g. "KSh 1,050 (incl. KSh 50 eCitizen fee)". "Free" if free. "See the official site" if not found.',
      },
      where: { type: 'string', description: 'Where to apply and where to go in person.' },
      steps: { type: 'array', items: { type: 'string' }, description: 'The steps in order, short.' },
      sources: {
        type: 'array',
        description: 'The official pages the facts came from.',
        items: {
          type: 'object',
          properties: { title: { type: 'string' }, url: { type: 'string' } },
          required: ['title', 'url'],
          additionalProperties: false,
        },
      },
    },
    required: ['items', 'fee', 'where', 'steps', 'sources'],
    additionalProperties: false,
  },
  strict: true,
};

export function baselineRequirements(task: GovTask): RequirementsCheck {
  return {
    items: task.requirements.map((r) => ({ label: r.label, note: '' })),
    fee: task.payment.free ? 'Free' : 'Shown on the official site when you apply',
    where: task.agency,
    steps: task.steps,
    sources: [{ title: task.portal.label.replace(/^Open /, ''), url: task.portal.url }],
    checkedAt: new Date().toISOString(),
    mode: 'sample',
  };
}

export async function checkRequirements(task: GovTask, refresh = false): Promise<RequirementsCheck> {
  const cached = cache.get(task.id);
  if (!refresh && cached && cached.expires > Date.now()) return cached.value;

  const client = claude();
  const today = new Date().toISOString().slice(0, 10);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `Task: ${task.title} in Kenya (${task.agency}).
What we already know (may be out of date):
- Needs: ${task.requirements.map((r) => r.label).join('; ')}
- Steps: ${task.steps.join(' ')}

Search the official sites for the current requirements, fee and steps, then call report_requirements.`,
    },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      ...modelOptions,
      ...(Object.keys(effortOption).length ? { output_config: effortOption } : {}),
      system: `You check Kenyan government service requirements for the Virtual Cybercafe app. Today is ${today}.
Use web search on the official sites only. Report facts only as the official source states them; never guess a fee. Keep every item short and plain, for someone on a phone.
Where the official source doesn't say, keep what we already know. Do not include this app's tools or advice in the report.`,
      tools: [
        {
          type: webSearchType,
          name: 'web_search',
          max_uses: 3,
          allowed_domains: task.officialDomains,
        },
        reportTool,
      ],
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;

    const report = response.content.find(
      (block): block is Anthropic.Beta.BetaToolUseBlock =>
        block.type === 'tool_use' && block.name === 'report_requirements',
    );
    if (report) {
      const input = report.input as Omit<RequirementsCheck, 'checkedAt' | 'mode'>;
      const value: RequirementsCheck = {
        ...input,
        sources: input.sources.filter((s) => /^https:\/\//.test(s.url)).slice(0, 5),
        checkedAt: new Date().toISOString(),
        mode: 'ai',
      };
      cache.set(task.id, { value, expires: Date.now() + CACHE_MS });
      return value;
    }

    // Anything other than a report means the model stopped early; ask once more.
    if (response.stop_reason === 'refusal') break;
    messages.push({ role: 'user', content: 'Please call report_requirements now with what you found.' });
  }
  return baselineRequirements(task);
}

const idSchema = {
  type: 'object',
  properties: {
    isKenyanId: { type: 'boolean', description: 'True if this is a Kenyan National ID card.' },
    fullName: { type: 'string', description: 'Full name as printed, in capitals, or empty if unreadable.' },
    idNumber: { type: 'string', description: 'ID number, digits only, or empty.' },
    dateOfBirth: { type: 'string', description: 'YYYY-MM-DD, or empty.' },
    sex: { type: 'string', description: 'MALE or FEMALE, or empty.' },
    placeOfBirth: { type: 'string', description: 'District or place of birth, or empty.' },
    dateOfIssue: { type: 'string', description: 'YYYY-MM-DD, or empty.' },
    problems: {
      type: 'array',
      items: { type: 'string' },
      description: 'Short notes for the user: blurry, glare, cut off, back side only, etc. Empty if all clear.',
    },
  },
  required: ['isKenyanId', 'fullName', 'idNumber', 'dateOfBirth', 'sex', 'placeOfBirth', 'dateOfIssue', 'problems'],
  additionalProperties: false,
} as const;

export async function readIdPhoto(base64: string, mediaType: 'image/jpeg' | 'image/png'): Promise<IdReadResult> {
  const client = claude();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    ...modelOptions,
    output_config: { ...effortOption, format: { type: 'json_schema', schema: idSchema } },
    system:
      'You read Kenyan National ID cards so the owner can fill government forms. Copy what is printed exactly; leave a field empty if you cannot read it clearly rather than guessing.',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Read the details on this ID card.' },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    return { details: {}, problems: ['Couldn’t read this photo. Please type your details instead.'], mode: 'ai' };
  }
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const parsed = JSON.parse(text) as IdDetails & { isKenyanId: boolean; problems: string[] };
  const { isKenyanId, problems, ...details } = parsed;
  const cleaned = Object.fromEntries(Object.entries(details).filter(([, value]) => value.trim())) as Partial<IdDetails>;
  if (cleaned.idNumber) cleaned.idNumber = cleaned.idNumber.replace(/\D/g, '');
  return {
    details: isKenyanId ? cleaned : {},
    problems: isKenyanId ? problems : ['This doesn’t look like a Kenyan National ID. Try a clear photo of the front.'],
    mode: 'ai',
  };
}
