import Anthropic from '@anthropic-ai/sdk';

import { cleanProfile } from '@/data/profile-fields';
import { emptyAdvert, sampleAdvert, sampleApplication, sampleMatch, sampleQuestions } from '@/lib/jobs-sample';
import type { FindJobsResult, JobAdvert, ReadAdvertResult } from '@/lib/jobs-types';
import { findJobs, interviewQuestions, JOB_SITES, matchJob, readAdvert, tailorApplication } from '@/server/jobs-agent';

const MAX_IMAGE_BASE64 = 5_000_000;
const methods = ['email', 'portal', 'in_person', 'post', 'unknown'] as const;

function str(value: unknown, max = 300) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function list(value: unknown, max = 20) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string').slice(0, max).map((v) => v.slice(0, 300)) : [];
}

// The advert comes back from the app, so it is re-checked like any input.
function cleanAdvert(value: unknown): JobAdvert | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Record<string, unknown>;
  const how = (a.howToApply ?? {}) as Record<string, unknown>;
  const advert: JobAdvert = {
    ...emptyAdvert(),
    title: str(a.title, 160),
    employer: str(a.employer, 160),
    location: str(a.location, 160),
    deadline: str(a.deadline, 10),
    deadlineText: str(a.deadlineText),
    salary: str(a.salary),
    howToApply: {
      method: methods.find((m) => m === how.method) ?? 'unknown',
      email: str(how.email, 160),
      url: str(how.url, 500),
      instructions: str(how.instructions, 600),
    },
    requirements: list(a.requirements),
    duties: list(a.duties),
    documents: list(a.documents),
    scamSignals: list(a.scamSignals),
    sourceUrl: str(a.sourceUrl, 500),
  };
  return advert.title ? advert : null;
}

function profileFrom(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  return cleanProfile(value as Record<string, unknown>);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  try {
    switch (body.action) {
      case 'read_advert': {
        const text = str(body.text, 20000);
        const url = str(body.url, 500);
        const image = typeof body.image === 'string' ? body.image : '';
        if (image.length > MAX_IMAGE_BASE64) return Response.json({ error: 'Send one photo under 3 MB' }, { status: 400 });
        if (!text.trim() && !url.trim() && !image) return Response.json({ error: 'Nothing to read' }, { status: 400 });
        if (url && !/^https?:\/\//i.test(url.trim())) {
          return Response.json({ advert: null, problem: 'That link should start with https://', mode: hasKey ? 'ai' : 'sample' } satisfies ReadAdvertResult);
        }
        if (!hasKey) {
          if (text.trim()) return Response.json({ advert: sampleAdvert(text, url), problem: '', mode: 'sample' } satisfies ReadAdvertResult);
          return Response.json({
            advert: null,
            problem: 'Reading a link or photo needs the AI to be switched on. Paste the advert text for now.',
            mode: 'sample',
          } satisfies ReadAdvertResult);
        }
        return Response.json(await readAdvert({ text, url, image: image || undefined }));
      }

      case 'find': {
        const query = str(body.query, 100).trim();
        const county = str(body.county, 60).trim();
        if (!query) return Response.json({ error: 'Say what job to look for' }, { status: 400 });
        if (!hasKey) {
          return Response.json({
            jobs: [],
            note: `Searching needs the AI to be switched on. For now, look on ${JOB_SITES.join(', ')} and paste an advert here.`,
            mode: 'sample',
          } satisfies FindJobsResult);
        }
        return Response.json(await findJobs(query, county));
      }

      case 'match':
      case 'tailor':
      case 'interview': {
        const advert = cleanAdvert(body.advert);
        if (!advert) return Response.json({ error: 'Missing advert' }, { status: 400 });
        const profile = profileFrom(body.profile);
        if (body.action === 'match') {
          const candidate = { profile, lockerFiles: list(body.lockerFiles, 60) };
          return Response.json(hasKey ? await matchJob(advert, candidate) : sampleMatch(advert, candidate));
        }
        if (body.action === 'tailor') {
          return Response.json(hasKey ? await tailorApplication(advert, profile) : sampleApplication(advert, profile));
        }
        return Response.json({ questions: hasKey ? await interviewQuestions(advert, profile) : sampleQuestions(advert) });
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error(error);
    }
    return Response.json({ error: 'The jobs helper is unavailable right now' }, { status: 502 });
  }
}
