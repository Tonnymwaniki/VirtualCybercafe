// Claude calls behind the Jobs workspace:
// - readAdvert: turns pasted text, a link or a photo of an advert into a job.
// - findJobs: searches trusted job sites and reports openings.
// - matchJob: compares an advert with the user's saved details and Locker.
// - tailorApplication: writes a CV, cover letter and email for one job.
// - interviewQuestions: practice questions for one job.
// Every result is checked for scam signs with plain rules as well.

import Anthropic from '@anthropic-ai/sdk';

import { cvDocumentSchema, type CvDocument } from '@/lib/cv';
import { cvAnswersFor, documentsInLocker, emailDraft, withScamCheck } from '@/lib/jobs-sample';
import type {
  AdvertInput,
  Candidate,
  FindJobsResult,
  FoundJob,
  InterviewQuestion,
  JobAdvert,
  MatchResult,
  ReadAdvertResult,
  TailoredApplication,
} from '@/lib/jobs-types';
import { effortOption, MODEL, modelOptions, webSearchType, WEB_CAUTION } from '@/server/model';
import { persistentCache } from '@/server/cache';
import { claude } from '@/server/claude';

export const JOB_SITES = ['publicservice.go.ke', 'psckjobs.go.ke', 'brightermonday.co.ke', 'myjobmag.co.ke', 'fuzu.com'];

const HONESTY = `Never invent employers, dates, qualifications, achievements or contact details. Use only what the user saved or the advert says.`;

async function jsonCall<T>(
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[] | string,
  schema: Record<string, unknown>,
  maxTokens = 3000,
): Promise<T | null> {
  const client = claude();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    ...modelOptions,
    output_config: { ...effortOption, format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return JSON.parse(text) as T;
}

// ---- Reading an advert ----

const stringList = { type: 'array', items: { type: 'string' } } as const;

const advertSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'isJobAdvert', 'title', 'employer', 'location', 'deadline', 'deadlineText', 'salary', 'method', 'email', 'url',
    'instructions', 'requirements', 'duties', 'documents', 'scamSignals',
  ],
  properties: {
    isJobAdvert: { type: 'boolean' },
    title: { type: 'string', description: 'The job title.' },
    employer: { type: 'string' },
    location: { type: 'string' },
    deadline: { type: 'string', description: 'Closing date as YYYY-MM-DD, or empty if not stated.' },
    deadlineText: { type: 'string', description: 'The closing date and time as written, or empty.' },
    salary: { type: 'string', description: 'As stated, or empty.' },
    method: { type: 'string', enum: ['email', 'portal', 'in_person', 'post', 'unknown'] },
    email: { type: 'string', description: 'Email address to apply to, exactly as written, or empty.' },
    url: { type: 'string', description: 'Website to apply on, or empty.' },
    instructions: { type: 'string', description: 'How to apply, in one or two plain sentences, including any reference number to quote.' },
    requirements: { ...stringList, description: 'Qualifications, experience and skills required, short items.' },
    duties: { ...stringList, description: 'Main duties, short items.' },
    documents: { ...stringList, description: 'Documents to send, e.g. CV, cover letter, ID copy, KCSE certificate, clearance certificates.' },
    scamSignals: { ...stringList, description: 'Plain warnings if the advert asks for money, promises jobs without interviews, or looks fake. Empty if none.' },
  },
} as const;

type AdvertJson = { isJobAdvert: boolean; method: JobAdvert['howToApply']['method']; email: string; url: string; instructions: string } & Omit<
  JobAdvert,
  'howToApply' | 'sourceUrl'
>;

const ADVERT_SYSTEM = `You read job adverts for job seekers in Kenya, for the Virtual Cybercafe app. Copy facts exactly as written; leave a field empty rather than guess. Keep list items short. Today is ${new Date().toISOString().slice(0, 10)}.
Flag scam signs plainly: any fee (registration, training, medical, interview), M-Pesa payment, WhatsApp-only applications, guaranteed jobs, or a government or big employer using a free email address.`;

// A reason the user can act on; other fetch errors stay in the server log.
class LinkError extends Error {}

function isPrivateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    !h.includes('.') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h.includes(':')
  );
}

function pageText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, 15000);
}

// Downloads a public web page's text. Follows up to three redirects, checking
// each hop, and refuses local or private addresses.
export async function fetchPage(link: string): Promise<string> {
  let url = new URL(link);
  for (let hop = 0; hop < 4; hop++) {
    if (!/^https?:$/.test(url.protocol) || isPrivateHost(url.hostname) || (url.port && !['80', '443'].includes(url.port))) {
      throw new LinkError('It isn’t a public web page.');
    }
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (VirtualCybercafe job reader)', Accept: 'text/html,text/plain' },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = new URL(response.headers.get('location')!, url);
      continue;
    }
    if (!response.ok) throw new LinkError(`The page answered ${response.status}.`);
    const type = response.headers.get('content-type') ?? '';
    if (!/text\/(html|plain)/.test(type)) throw new LinkError('That link isn’t a web page.');
    const html = (await response.text()).slice(0, 800_000);
    return type.includes('html') ? pageText(html) : html.slice(0, 15000);
  }
  throw new LinkError('Too many redirects.');
}

export async function readAdvert(input: AdvertInput): Promise<ReadAdvertResult> {
  let text = input.text?.trim() ?? '';
  const sourceUrl = input.url?.trim() ?? '';
  if (!text && sourceUrl) {
    try {
      text = await fetchPage(sourceUrl);
    } catch (error) {
      if (!(error instanceof LinkError)) console.error('Job link fetch failed:', error);
      const why = error instanceof LinkError ? `${error.message} ` : '';
      return { advert: null, problem: `Couldn’t open that link. ${why}Copy the advert text and paste it instead.`, mode: 'ai' };
    }
    if (text.length < 200) {
      return { advert: null, problem: 'That page had almost no text (it may need a login). Paste the advert text instead.', mode: 'ai' };
    }
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = input.image
    ? [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: input.image } },
        { type: 'text', text: 'This is a photo of a job advert (for example from a newspaper). Read it.' },
      ]
    : [{ type: 'text', text: `${sourceUrl ? `Advert from ${sourceUrl}:\n` : ''}${text}` }];

  const parsed = await jsonCall<AdvertJson>(ADVERT_SYSTEM, content, advertSchema);
  if (!parsed) return { advert: null, problem: 'Couldn’t read that advert.', mode: 'ai' };
  if (!parsed.isJobAdvert) {
    return { advert: null, problem: 'That doesn’t look like a job advert. Try the full advert text or a clearer photo.', mode: 'ai' };
  }
  const { isJobAdvert: _, method, email, url, instructions, ...rest } = parsed;
  const advert: JobAdvert = {
    ...rest,
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(rest.deadline) ? rest.deadline : '',
    howToApply: { method, email, url: /^https?:\/\//.test(url) ? url : '', instructions },
    sourceUrl,
  };
  return { advert: withScamCheck(advert, text), problem: '', mode: 'ai' };
}

// ---- Finding jobs ----

const FIND_CACHE_MS = 12 * 60 * 60 * 1000;
const findCache = persistentCache<FindJobsResult>('job-search');

const reportJobsTool: Anthropic.Beta.BetaTool = {
  name: 'report_jobs',
  description: 'Report the open jobs you found. Call this once, after searching.',
  input_schema: {
    type: 'object',
    properties: {
      jobs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            employer: { type: 'string' },
            location: { type: 'string' },
            deadline: { type: 'string', description: 'Closing date as written, or empty.' },
            url: { type: 'string', description: 'The page for this job.' },
            summary: { type: 'string', description: 'One short line: key requirement or pay.' },
          },
          required: ['title', 'employer', 'location', 'deadline', 'url', 'summary'],
          additionalProperties: false,
        },
      },
      note: { type: 'string', description: 'One short line for the user, e.g. where else to look. Empty if nothing to add.' },
    },
    required: ['jobs', 'note'],
    additionalProperties: false,
  },
  strict: true,
};

export async function findJobs(query: string, county: string): Promise<FindJobsResult> {
  const key = `${query.toLowerCase()}|${county.toLowerCase()}`;
  const cached = findCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const client = claude();
  const today = new Date().toISOString().slice(0, 10);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `Find open jobs in Kenya for: ${query}${county ? `, in or near ${county}` : ''}. Include government jobs from the Public Service Commission if relevant. Then call report_jobs with up to 8 jobs whose closing date has not passed.`,
    },
  ];
  for (let step = 0; step < 4; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 3000,
      ...modelOptions,
      ...(Object.keys(effortOption).length ? { output_config: effortOption } : {}),
      system: `You find job openings for job seekers in Kenya. Today is ${today}. Search the trusted job sites only. Report only real openings you saw in the results, with the link to each. Skip anything asking applicants for money. ${WEB_CAUTION}`,
      tools: [{ type: webSearchType, name: 'web_search', max_uses: 3, allowed_domains: JOB_SITES }, reportJobsTool],
      messages,
    });
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    const report = response.content.find(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use' && block.name === 'report_jobs',
    );
    if (report) {
      const input = report.input as { jobs: FoundJob[]; note: string };
      const value: FindJobsResult = {
        jobs: input.jobs.filter((job) => /^https:\/\//.test(job.url)).slice(0, 8),
        note: input.note,
        mode: 'ai',
      };
      findCache.set(key, { value, expires: Date.now() + FIND_CACHE_MS });
      return value;
    }
    if (response.stop_reason === 'refusal') break;
    messages.push({ role: 'user', content: 'Please call report_jobs now with what you found.' });
  }
  return { jobs: [], note: 'No openings found right now. Try a broader job type.', mode: 'ai' };
}

// ---- Match check ----

function profileText(profile: Record<string, string>) {
  const keys = ['experience', 'education', 'skills', 'highestLevel', 'school', 'kcseYear', 'occupation', 'employer', 'county', 'town', 'dateOfBirth'];
  return keys.filter((k) => profile[k]).map((k) => `${k}: ${profile[k]}`).join('\n') || '(nothing saved yet)';
}

function advertText(advert: JobAdvert) {
  return `Job: ${advert.title} at ${advert.employer || 'unknown employer'}, ${advert.location}
Deadline: ${advert.deadlineText || advert.deadline || 'not stated'}
Requirements:\n${advert.requirements.map((r) => `- ${r}`).join('\n') || '- (none listed)'}
Duties:\n${advert.duties.map((d) => `- ${d}`).join('\n') || '- (none listed)'}
Documents to send: ${advert.documents.join(', ') || 'not stated'}`;
}

const matchSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['fit', 'summary', 'matches', 'gaps'],
  properties: {
    fit: { type: 'string', enum: ['strong', 'fair', 'weak'] },
    summary: { type: 'string', description: 'Two short sentences for the applicant.' },
    matches: { ...stringList, description: 'Requirements the applicant clearly meets, each with the evidence in a few words.' },
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item', 'fix'],
        properties: {
          item: { type: 'string', description: 'A requirement not shown in their details.' },
          fix: { type: 'string', description: 'One practical step: add it to My Details if they have it, get a document, or highlight related experience.' },
        },
      },
    },
  },
} as const;

export async function matchJob(advert: JobAdvert, candidate: Candidate): Promise<MatchResult> {
  const parsed = await jsonCall<Omit<MatchResult, 'documents' | 'checkedAt' | 'mode'>>(
    `You compare a job advert with an applicant's saved details, for job seekers in Kenya. Be honest and encouraging. A requirement counts as met only if their details show it. ${HONESTY}`,
    `${advertText(advert)}\n\nThe applicant's saved details:\n${profileText(candidate.profile)}\n\nFiles in their Locker: ${candidate.lockerFiles.join(', ') || '(none)'}`,
    matchSchema,
    2000,
  );
  if (!parsed) throw new Error('refused');
  return { ...parsed, documents: documentsInLocker(advert, candidate.lockerFiles), checkedAt: new Date().toISOString(), mode: 'ai' };
}

// ---- Tailored CV, letter and email ----

const applicationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cv', 'email'],
  properties: {
    cv: cvDocumentSchema,
    email: {
      type: 'object',
      additionalProperties: false,
      required: ['subject', 'body'],
      properties: { subject: { type: 'string' }, body: { type: 'string' } },
    },
  },
} as const;

export async function tailorApplication(advert: JobAdvert, profile: Record<string, string>): Promise<TailoredApplication> {
  const answers = cvAnswersFor(advert, profile);
  const parsed = await jsonCall<{ cv: CvDocument; email: { subject: string; body: string } }>(
    `You write CVs, cover letters and application emails for job seekers in Kenya, tailored to one advert, in British English. ${HONESTY}
- CV: headline is the advert's job title; summary 2-3 sentences aimed at this job; order experience bullets and skills so what the advert asks for comes first, using the advert's words where they truthfully apply; 2-4 bullets per job starting with a verb.
- Cover letter: 3-4 short paragraphs separated by blank lines, addressed to the employer, naming the job and any reference number, linking their real experience to the advert's requirements. Start "Dear Hiring Manager," and end "Yours faithfully," then their name.
- Email: a short subject with the job title and any reference number, and a 3-4 line body saying the cover letter, CV and certificates are attached, signed with their name and phone.`,
    `${advertText(advert)}\nHow to apply: ${advert.howToApply.instructions}\n\nThe applicant:\nName: ${answers.fullName}\nPhone: ${answers.phone}\nEmail: ${answers.email}\nLocation: ${answers.location}\nExperience:\n${answers.experience || '(none given)'}\nEducation:\n${answers.education || '(none given)'}\nSkills: ${answers.skills || '(none given)'}`,
    applicationSchema,
    5000,
  );
  if (!parsed) throw new Error('refused');
  return {
    cv: parsed.cv,
    email: parsed.email.subject ? parsed.email : emailDraft(advert, answers.fullName),
    writtenAt: new Date().toISOString(),
    mode: 'ai',
  };
}

// ---- Interview practice ----

const questionsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'tip'],
        properties: {
          question: { type: 'string' },
          tip: { type: 'string', description: 'How this applicant could answer, using their real experience, in one or two sentences.' },
        },
      },
    },
  },
} as const;

export async function interviewQuestions(advert: JobAdvert, profile: Record<string, string>): Promise<InterviewQuestion[]> {
  const parsed = await jsonCall<{ questions: InterviewQuestion[] }>(
    `You prepare job seekers in Kenya for interviews. Write 8 likely interview questions for this job, mixing general, technical and situational ones, based on the advert's duties and requirements. Tips point to the applicant's real experience where it fits. ${HONESTY}`,
    `${advertText(advert)}\n\nThe applicant's saved details:\n${profileText(profile)}`,
    questionsSchema,
    2500,
  );
  if (!parsed) throw new Error('refused');
  return parsed.questions.slice(0, 10);
}
