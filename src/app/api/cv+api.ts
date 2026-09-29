import Anthropic from '@anthropic-ai/sdk';

import {
  cvDocumentSchema,
  cvQuestions,
  sampleCv,
  type CvAnswers,
  type CvDocument,
  type CvResponse,
} from '@/lib/cv';
import { effortOption, MODEL, modelOptions } from '@/server/model';
import { claude } from '@/server/claude';
import { withUsage } from '@/server/usage';

const SYSTEM_PROMPT = `You write CVs and cover letters for job seekers in Kenya, for the Virtual Cybercafe app.
Turn the applicant's rough answers into a clean, honest, professional CV and a one-page cover letter in British English.
- Never invent employers, dates, qualifications or achievements; only polish and structure what the applicant gave.
- Headline: the target job title.
- Summary: 2-3 sentences aimed at the target job.
- Experience: most recent first, 2-4 short achievement-style bullets per job, starting with a verb.
- Skills: short phrases.
- Cover letter: 3-4 short paragraphs separated by blank lines, starting "Dear Hiring Manager," and ending "Yours faithfully," then the applicant's name. Address the named company if given.`;

function readAnswers(body: unknown): CvAnswers | null {
  if (!body || typeof body !== 'object') return null;
  const source = (body as { answers?: Record<string, unknown> }).answers ?? {};
  const answers = {} as CvAnswers;
  for (const { key, optional } of cvQuestions) {
    const value = source[key];
    if (typeof value !== 'string' || (!optional && !value.trim())) return null;
    answers[key] = value.slice(0, 4000);
  }
  return answers;
}

export function POST(request: Request) {
  return withUsage(request, 'cv', () => handle(request));
}

async function handle(request: Request) {
  let answers: CvAnswers | null = null;
  try {
    answers = readAnswers(await request.json());
  } catch {
    // fall through to the 400 below
  }
  if (!answers) {
    return Response.json({ error: 'Missing answers' }, { status: 400 });
  }

  // Until an API key is configured, fill a template instead.
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ cv: sampleCv(answers), mode: 'sample' } satisfies CvResponse);
  }

  const client = claude();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      ...modelOptions,
      output_config: {
        ...effortOption,
        format: { type: 'json_schema', schema: cvDocumentSchema },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here are the applicant's answers as JSON:\n${JSON.stringify(answers, null, 2)}`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return Response.json({ cv: sampleCv(answers), mode: 'sample' } satisfies CvResponse);
    }
    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const cv = JSON.parse(text) as CvDocument;
    return Response.json({ cv, mode: 'ai' } satisfies CvResponse);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic API key is invalid');
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error('Anthropic rate limit hit');
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error(error);
    }
    return Response.json({ error: 'Could not write the CV right now' }, { status: 502 });
  }
}
