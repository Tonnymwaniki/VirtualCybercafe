// Shapes shared by the Education screens, /api/education and the education agent.

import type { Level } from '@/lib/kcse';

// Record-store prefixes: one KUCCPS plan ("plan") and any number of letters.
export const KUCCPS_KEY = 'edu:kuccps:';
export const LETTER_KEY = 'edu:letter:';

export type CourseSuggestion = {
  programme: string;
  institution: string;
  level: string;
  // Subject and mean-grade requirements, as KUCCPS states them.
  requirement: string;
  // The last cut-off points, as stated, or empty.
  lastCutoff: string;
  fit: 'likely' | 'possible' | 'reach';
  why: string;
  url: string;
};

export type CourseSearch = { courses: CourseSuggestion[]; note: string; mode: 'ai' | 'sample' };

export type CourseQuery = {
  grades: string;
  meanGrade: string;
  interests: string;
  level: Level;
  county: string;
};

export const kuccpsStages = [
  'KCSE results ready',
  'Courses chosen',
  'Applied on the KUCCPS portal',
  'Placement out',
  'Revision (if needed)',
  'Reported to college',
];

// Live job-market research for one or more courses.
export type CourseDemand = {
  programme: string;
  demand: 'high' | 'medium' | 'low';
  // How many current adverts the search saw, in words, e.g. "About 12 adverts".
  openingsSeen: string;
  roles: string[];
  salary: string;
  skills: string[];
  note: string;
};

export type DemandReport = {
  courses: CourseDemand[];
  summary: string;
  alternatives: { programme: string; why: string }[];
  sources: { title: string; url: string }[];
  checkedAt: string;
  mode: 'ai' | 'sample';
};

export type KuccpsPlan = {
  demand?: DemandReport;
  choices: CourseSuggestion[];
  stage: number;
  stageDates: Record<number, string>;
  interests: string;
  level: Level;
};

export type AdmissionLetter = {
  institution: string;
  course: string;
  // YYYY-MM-DD when known; reportingText keeps the wording.
  reportingDate: string;
  reportingText: string;
  fees: { item: string; amount: string }[];
  total: string;
  // How to pay, exactly as printed: bank, account, paybill.
  payment: string;
  toBring: string[];
  notes: string[];
  warnings: string[];
};

export type SavedLetter = {
  id: string;
  letter: AdmissionLetter;
  // Items from toBring the user has ticked.
  ready: string[];
  createdAt: string;
};

export type ReadLetterResult = { letter: AdmissionLetter | null; problem: string; mode: 'ai' | 'sample' };
