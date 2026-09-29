import { sampleCourses, sampleDemand, sampleLetter } from '@/lib/edu-sample';
import type { CourseQuery, CourseSearch, DemandReport, ReadLetterResult } from '@/lib/edu-types';

async function post<T>(body: object): Promise<T> {
  const response = await fetch('/api/education', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function findCourses(query: CourseQuery): Promise<CourseSearch> {
  try {
    return await post<CourseSearch>({ action: 'courses', ...query });
  } catch {
    return { ...sampleCourses(query), note: 'Couldn’t search right now. Check your connection and try again.' };
  }
}

export async function readAdmissionLetter(input: { text?: string; image?: string }): Promise<ReadLetterResult> {
  try {
    return await post<ReadLetterResult>({ action: 'read_letter', ...input });
  } catch {
    if (input.text?.trim()) return { letter: sampleLetter(input.text), problem: '', mode: 'sample' };
    return { letter: null, problem: 'Couldn’t reach the letter reader. Check your connection and try again.', mode: 'sample' };
  }
}

export async function checkDemand(programmes: string[], meanGrade: string): Promise<DemandReport> {
  try {
    return await post<DemandReport>({ action: 'demand', programmes, meanGrade });
  } catch {
    return { ...sampleDemand(), summary: 'Couldn’t check the job market right now. Check your connection and try again.' };
  }
}
