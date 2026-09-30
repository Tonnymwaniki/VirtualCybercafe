import { apiFetch, throwIfFailed } from '@/lib/api';
import { failureText } from '@/lib/failure';
import { sampleCourses, sampleDemand, sampleLetter } from '@/lib/edu-sample';
import type { CourseQuery, CourseSearch, DemandReport, ReadLetterResult } from '@/lib/edu-types';

async function post<T>(body: object): Promise<T> {
  const response = await apiFetch('/api/education', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await throwIfFailed(response);
  return (await response.json()) as T;
}

export async function findCourses(query: CourseQuery): Promise<CourseSearch> {
  try {
    return await post<CourseSearch>({ action: 'courses', ...query });
  } catch (error) {
    return { ...sampleCourses(query), note: failureText('Couldn’t search right now.', error) };
  }
}

export async function readAdmissionLetter(input: { text?: string; image?: string }): Promise<ReadLetterResult> {
  try {
    return await post<ReadLetterResult>({ action: 'read_letter', ...input });
  } catch (error) {
    if (input.text?.trim()) return { letter: sampleLetter(input.text), problem: '', mode: 'sample' };
    return { letter: null, problem: failureText('Couldn’t reach the letter reader.', error), mode: 'sample' };
  }
}

export async function checkDemand(programmes: string[], meanGrade: string): Promise<DemandReport> {
  try {
    return await post<DemandReport>({ action: 'demand', programmes, meanGrade });
  } catch (error) {
    return { ...sampleDemand(), summary: failureText('Couldn’t check the job market right now.', error) };
  }
}
