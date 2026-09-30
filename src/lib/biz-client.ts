import type { Profile } from '@/data/profile-fields';
import { apiFetch, throwIfFailed } from '@/lib/api';
import { failureText } from '@/lib/failure';
import { sampleWritten } from '@/lib/biz-sample';
import type { TenderSearch, WriteBrief, WriteResult, WrittenKind } from '@/lib/biz-types';

async function post<T>(body: object): Promise<T> {
  const response = await apiFetch('/api/business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await throwIfFailed(response);
  return (await response.json()) as T;
}

export async function writeBusinessDoc(kind: WrittenKind, brief: WriteBrief, profile: Profile): Promise<WriteResult> {
  try {
    return await post<WriteResult>({ action: 'write', kind, brief, profile });
  } catch (error) {
    return { content: sampleWritten(kind, brief, profile), problem: failureText('Couldn’t reach the writer, so this is a simple draft.', error), mode: 'sample' };
  }
}

export async function searchTenders(query: string, county: string, agpoCategory: string): Promise<TenderSearch> {
  try {
    return await post<TenderSearch>({ action: 'tenders', query, county, agpoCategory });
  } catch (error) {
    return { tenders: [], note: failureText('Couldn’t search right now.', error), mode: 'sample' };
  }
}
