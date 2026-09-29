import type { Profile } from '@/data/profile-fields';
import { apiFetch } from '@/lib/api';
import { sampleLetter } from '@/lib/travel-sample';
import type { AgencyCheck, LetterKind, LetterResult, Trip, TripPurpose, VisaCheck } from '@/lib/travel-types';

async function post<T>(body: object): Promise<T> {
  const response = await apiFetch('/api/travel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function checkVisa(destination: string, purpose: TripPurpose): Promise<VisaCheck | null> {
  try {
    return await post<VisaCheck>({ action: 'visa', destination, purpose });
  } catch {
    return null;
  }
}

export async function writeTripLetter(kind: LetterKind, trip: Trip, profile: Profile, notes: string): Promise<LetterResult> {
  const { destination, purpose, departDate, returnDate } = trip;
  try {
    return await post<LetterResult>({ action: 'letter', kind, trip: { destination, purpose, departDate, returnDate }, profile, notes });
  } catch {
    return { letter: sampleLetter(kind, trip, profile, notes), problem: 'Couldn’t reach the writer, so this is a simple draft.' };
  }
}

export async function checkAgency(name: string): Promise<AgencyCheck | null> {
  try {
    return await post<AgencyCheck>({ action: 'agency', name });
  } catch {
    return null;
  }
}
