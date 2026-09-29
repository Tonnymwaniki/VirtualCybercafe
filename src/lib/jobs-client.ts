import { apiFetch } from '@/lib/api';
import { sampleAdvert, sampleApplication, sampleMatch, sampleQuestions } from '@/lib/jobs-sample';
import type {
  AdvertInput,
  FindJobsResult,
  InterviewQuestion,
  JobAdvert,
  MatchResult,
  ReadAdvertResult,
  TailoredApplication,
} from '@/lib/jobs-types';

async function post<T>(body: object): Promise<T> {
  const response = await apiFetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function readJobAdvert(input: AdvertInput): Promise<ReadAdvertResult> {
  try {
    return await post<ReadAdvertResult>({ action: 'read_advert', ...input });
  } catch {
    if (input.text?.trim()) return { advert: sampleAdvert(input.text, input.url), problem: '', mode: 'sample' };
    return { advert: null, problem: 'Couldn’t reach the job reader. Check your connection, or paste the advert text.', mode: 'sample' };
  }
}

export async function findJobs(query: string, county: string): Promise<FindJobsResult> {
  try {
    return await post<FindJobsResult>({ action: 'find', query, county });
  } catch {
    return { jobs: [], note: 'Couldn’t search right now. Check your connection and try again.', mode: 'sample' };
  }
}

type Me = { profile: Record<string, string>; lockerFiles?: string[] };

export async function checkMatch(advert: JobAdvert, me: Me): Promise<MatchResult> {
  try {
    return await post<MatchResult>({ action: 'match', advert, ...me });
  } catch {
    return sampleMatch(advert, { profile: me.profile, lockerFiles: me.lockerFiles ?? [] });
  }
}

export async function tailorApplication(advert: JobAdvert, profile: Record<string, string>): Promise<TailoredApplication> {
  try {
    return await post<TailoredApplication>({ action: 'tailor', advert, profile });
  } catch {
    return sampleApplication(advert, profile);
  }
}

export async function interviewQuestions(advert: JobAdvert, profile: Record<string, string>): Promise<InterviewQuestion[]> {
  try {
    return (await post<{ questions: InterviewQuestion[] }>({ action: 'interview', advert, profile })).questions;
  } catch {
    return sampleQuestions(advert);
  }
}
