// Shapes shared by the Jobs workspace screens, the /api/jobs route and the
// jobs agent.

import type { CvDocument } from '@/lib/cv';

export type ApplyMethod = 'email' | 'portal' | 'in_person' | 'post' | 'unknown';

export type JobAdvert = {
  title: string;
  employer: string;
  location: string;
  // YYYY-MM-DD when known, otherwise empty; deadlineText keeps the wording.
  deadline: string;
  deadlineText: string;
  salary: string;
  howToApply: { method: ApplyMethod; email: string; url: string; instructions: string };
  requirements: string[];
  duties: string[];
  documents: string[];
  // Warnings that the advert may be a scam, in plain words.
  scamSignals: string[];
  sourceUrl: string;
};

export type MatchResult = {
  fit: 'strong' | 'fair' | 'weak';
  summary: string;
  matches: string[];
  gaps: { item: string; fix: string }[];
  documents: { name: string; inLocker: boolean }[];
  checkedAt: string;
  mode: 'ai' | 'sample';
};

export type TailoredApplication = {
  cv: CvDocument;
  email: { subject: string; body: string };
  writtenAt: string;
  mode: 'ai' | 'sample';
};

export type InterviewQuestion = { question: string; tip: string };

export const jobStatuses = ['Saved', 'Applied', 'Shortlisted', 'Interview', 'Offer'] as const;

export type Job = {
  id: string;
  advert: JobAdvert;
  // Index into jobStatuses; -1 once the user marks it not successful.
  status: number;
  closed?: boolean;
  statusDates: Record<number, string>;
  match?: MatchResult;
  application?: TailoredApplication;
  questions?: InterviewQuestion[];
  portalAnswers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type FoundJob = {
  title: string;
  employer: string;
  location: string;
  deadline: string;
  url: string;
  summary: string;
};

export type FindJobsResult = { jobs: FoundJob[]; note: string; mode: 'ai' | 'sample' };

export type AdvertInput = { text?: string; url?: string; image?: string };

export type ReadAdvertResult = { advert: JobAdvert | null; problem: string; mode: 'ai' | 'sample' };

// What the server needs to compare an advert with the user.
export type Candidate = {
  profile: Record<string, string>;
  lockerFiles: string[];
};
