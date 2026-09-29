// Claude calls behind the Education workspace:
// - suggestCourses: searches KUCCPS for programmes that fit the student's
//   grades and interests, and reports them through a strict tool.
// - readLetter: reads an admission letter or fee structure.

import Anthropic from '@anthropic-ai/sdk';

import { letterWarnings } from '@/lib/edu-sample';
import type { AdmissionLetter, CourseDemand, CourseQuery, CourseSearch, CourseSuggestion, DemandReport, ReadLetterResult } from '@/lib/edu-types';
import { JOB_SITES } from '@/server/jobs-agent';
import { mergeSignals } from '@/lib/job-scam';
import { effortOption, MODEL, modelOptions, webSearchType } from '@/server/model';

export const KUCCPS_SITES = ['kuccps.ac.ke', 'kuccps.net'];

const CACHE_MS = 24 * 60 * 60 * 1000;
const globalCache = globalThis as { courseCache?: Map<string, { value: CourseSearch; expires: number }> };
const cache = (globalCache.courseCache ??= new Map());

const reportTool: Anthropic.Beta.BetaTool = {
  name: 'report_courses',
  description: 'Report the programmes that suit the student. Call this once, after searching.',
  input_schema: {
    type: 'object',
    properties: {
      courses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            programme: { type: 'string' },
            institution: { type: 'string' },
            level: { type: 'string', description: 'Degree, Diploma, Certificate or Artisan.' },
            requirement: { type: 'string', description: 'Minimum mean grade and subject grades, as KUCCPS states them.' },
            lastCutoff: { type: 'string', description: 'Last cut-off points as stated, with the year, or empty.' },
            fit: { type: 'string', enum: ['likely', 'possible', 'reach'] },
            why: { type: 'string', description: 'One short line comparing the requirement with the student’s grades.' },
            url: { type: 'string', description: 'The page the facts came from.' },
          },
          required: ['programme', 'institution', 'level', 'requirement', 'lastCutoff', 'fit', 'why', 'url'],
          additionalProperties: false,
        },
      },
      note: { type: 'string', description: 'One or two short lines of advice for the student, or empty.' },
    },
    required: ['courses', 'note'],
    additionalProperties: false,
  },
  strict: true,
};

export async function suggestCourses(query: CourseQuery): Promise<CourseSearch> {
  const key = JSON.stringify(query).toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `A Kenyan student wants ${query.level.toLowerCase()} programmes through KUCCPS.
KCSE mean grade: ${query.meanGrade || 'not given'}
Subject grades:
${query.grades || '(not given)'}
Interests: ${query.interests || 'open to suggestions'}
${query.county ? `Prefers colleges in or near: ${query.county}` : ''}
Search KUCCPS for up to 8 suitable programmes, then call report_courses.`,
    },
  ];

  for (let step = 0; step < 4; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      ...modelOptions,
      ...(Object.keys(effortOption).length ? { output_config: effortOption } : {}),
      system: `You help Kenyan students choose KUCCPS programmes for the Virtual Cybercafe app. Today is ${new Date().toISOString().slice(0, 10)}.
Search the KUCCPS sites only. Report requirements and cut-offs exactly as KUCCPS states them; never guess a cut-off.
Mark fit "likely" only when the student's grades clearly meet every stated requirement, "possible" when they meet the minimums but competition is high or a detail is unclear, and "reach" otherwise. Only KUCCPS decides placement; you advise.`,
      tools: [{ type: webSearchType, name: 'web_search', max_uses: 3, allowed_domains: KUCCPS_SITES }, reportTool],
      messages,
    });
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    const report = response.content.find(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use' && block.name === 'report_courses',
    );
    if (report) {
      const input = report.input as { courses: CourseSuggestion[]; note: string };
      const value: CourseSearch = {
        courses: input.courses.map((c) => ({ ...c, url: /^https:\/\//.test(c.url) ? c.url : '' })).slice(0, 8),
        note: input.note,
        mode: 'ai',
      };
      cache.set(key, { value, expires: Date.now() + CACHE_MS });
      return value;
    }
    if (response.stop_reason === 'refusal') break;
    messages.push({ role: 'user', content: 'Please call report_courses now with what you found.' });
  }
  return { courses: [], note: 'No programmes found right now. Try broader interests.', mode: 'ai' };
}

const letterSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['isLetter', 'institution', 'course', 'reportingDate', 'reportingText', 'fees', 'total', 'payment', 'toBring', 'notes', 'warnings'],
  properties: {
    isLetter: { type: 'boolean', description: 'True for an admission letter, joining instructions or fee structure.' },
    institution: { type: 'string' },
    course: { type: 'string' },
    reportingDate: { type: 'string', description: 'First reporting date as YYYY-MM-DD, or empty.' },
    reportingText: { type: 'string', description: 'The reporting date, time and place as written, or empty.' },
    fees: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item', 'amount'],
        properties: { item: { type: 'string' }, amount: { type: 'string', description: 'As printed, e.g. "KSh 12,500".' } },
      },
      description: 'Fees for the first semester or year, one line per item.',
    },
    total: { type: 'string', description: 'Total as printed, or empty.' },
    payment: { type: 'string', description: 'How to pay exactly as printed: bank, account name and number, paybill. Empty if not stated.' },
    toBring: { type: 'array', items: { type: 'string' }, description: 'Documents and items to bring when reporting, short.' },
    notes: { type: 'array', items: { type: 'string' }, description: 'Other important instructions, short.' },
    warnings: { type: 'array', items: { type: 'string' }, description: 'Plain warnings if fees go to a personal phone number or anything looks fake. Empty if none.' },
  },
} as const;

export async function readLetter(input: { text?: string; image?: string }): Promise<ReadLetterResult> {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = input.image
    ? [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: input.image } },
        { type: 'text', text: 'This is a photo of an admission letter or fee structure. Read it.' },
      ]
    : [{ type: 'text', text: input.text ?? '' }];
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 3000,
    ...modelOptions,
    output_config: { ...effortOption, format: { type: 'json_schema', schema: letterSchema } },
    system:
      'You read Kenyan university, college and school admission letters and fee structures for students and parents. Copy names, dates, amounts and account numbers exactly as printed; leave a field empty rather than guess.',
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') return { letter: null, problem: 'Couldn’t read that letter.', mode: 'ai' };
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const { isLetter, ...letter } = JSON.parse(text) as AdmissionLetter & { isLetter: boolean };
  if (!isLetter) {
    return { letter: null, problem: 'That doesn’t look like an admission letter or fee structure. Try a clearer photo of the whole page.', mode: 'ai' };
  }
  const warnings = mergeSignals(letter.warnings, letterWarnings([input.text ?? '', letter.payment].join('\n')));
  return {
    letter: { ...letter, reportingDate: /^\d{4}-\d{2}-\d{2}$/.test(letter.reportingDate) ? letter.reportingDate : '', warnings },
    problem: '',
    mode: 'ai',
  };
}

// ---- Job market check ----

const DEMAND_SITES = [...JOB_SITES, 'knbs.or.ke', 'kuccps.ac.ke'];
const demandCache = ((globalThis as { courseDemandCache?: Map<string, { value: DemandReport; expires: number }> }).courseDemandCache ??=
  new Map());

const demandTool: Anthropic.Beta.BetaTool = {
  name: 'report_demand',
  description: 'Report the job market for each course. Call this once, after searching.',
  input_schema: {
    type: 'object',
    properties: {
      courses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            programme: { type: 'string' },
            demand: { type: 'string', enum: ['high', 'medium', 'low'] },
            openingsSeen: { type: 'string', description: 'Roughly how many current Kenyan adverts you saw for jobs this course leads to, e.g. "About 15 adverts". Say "Few found" if unsure.' },
            roles: { type: 'array', items: { type: 'string' }, description: 'Job titles this course leads to, seen in adverts.' },
            salary: { type: 'string', description: 'Pay range as stated in adverts or official statistics, with the source, or empty.' },
            skills: { type: 'array', items: { type: 'string' }, description: 'Skills employers ask for most, short.' },
            note: { type: 'string', description: 'One short line: prospects, competition or where the jobs are.' },
          },
          required: ['programme', 'demand', 'openingsSeen', 'roles', 'salary', 'skills', 'note'],
          additionalProperties: false,
        },
      },
      summary: { type: 'string', description: 'Two or three plain sentences comparing the courses for the student.' },
      alternatives: {
        type: 'array',
        items: {
          type: 'object',
          properties: { programme: { type: 'string' }, why: { type: 'string' } },
          required: ['programme', 'why'],
          additionalProperties: false,
        },
        description: 'Up to 3 related courses with stronger demand that fit the student’s grades, or empty.',
      },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          properties: { title: { type: 'string' }, url: { type: 'string' } },
          required: ['title', 'url'],
          additionalProperties: false,
        },
      },
    },
    required: ['courses', 'summary', 'alternatives', 'sources'],
    additionalProperties: false,
  },
  strict: true,
};

export async function courseDemand(programmes: string[], meanGrade: string): Promise<DemandReport> {
  const key = `${programmes.join('|').toLowerCase()}#${meanGrade}`;
  const cached = demandCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `A Kenyan student is choosing between these courses:
${programmes.map((p, i) => `${i + 1}. ${p}`).join('\n')}
KCSE mean grade: ${meanGrade || 'not given'}
Research the current job market in Kenya for each: search recent job adverts for the jobs each course leads to, and official labour statistics. Then call report_demand.`,
    },
  ];
  for (let step = 0; step < 5; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      ...modelOptions,
      ...(Object.keys(effortOption).length ? { output_config: effortOption } : {}),
      system: `You research the Kenyan job market for students choosing courses, for the Virtual Cybercafe app. Today is ${new Date().toISOString().slice(0, 10)}.
Search the trusted job sites and official statistics only. Base demand on what you actually saw: the number and recency of adverts, and statistics. Quote pay only as stated in a source. Be honest and balanced: demand is one factor; the student's interest and ability matter too.`,
      tools: [{ type: webSearchType, name: 'web_search', max_uses: 5, allowed_domains: DEMAND_SITES }, demandTool],
      messages,
    });
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    const report = response.content.find(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use' && block.name === 'report_demand',
    );
    if (report) {
      const input = report.input as Omit<DemandReport, 'checkedAt' | 'mode'> & { courses: CourseDemand[] };
      const value: DemandReport = {
        ...input,
        alternatives: input.alternatives.slice(0, 3),
        sources: input.sources.filter((s) => /^https:\/\//.test(s.url)).slice(0, 6),
        checkedAt: new Date().toISOString(),
        mode: 'ai',
      };
      demandCache.set(key, { value, expires: Date.now() + CACHE_MS });
      return value;
    }
    if (response.stop_reason === 'refusal') break;
    messages.push({ role: 'user', content: 'Please call report_demand now with what you found.' });
  }
  return {
    courses: [],
    summary: 'I couldn’t finish the job market check right now. Try again in a moment.',
    alternatives: [],
    sources: [],
    checkedAt: new Date().toISOString(),
    mode: 'ai',
  };
}
