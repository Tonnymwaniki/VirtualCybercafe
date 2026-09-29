import type { Profile } from '@/data/profile-fields';
import { sampleWritten } from '@/lib/biz-sample';
import type { TenderSearch, WriteBrief, WriteResult, WrittenKind } from '@/lib/biz-types';

async function post<T>(body: object): Promise<T> {
  const response = await fetch('/api/business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function writeBusinessDoc(kind: WrittenKind, brief: WriteBrief, profile: Profile): Promise<WriteResult> {
  try {
    return await post<WriteResult>({ action: 'write', kind, brief, profile });
  } catch {
    return { content: sampleWritten(kind, brief, profile), problem: 'Couldn’t reach the writer, so this is a simple draft.', mode: 'sample' };
  }
}

export async function searchTenders(query: string, county: string, agpoCategory: string): Promise<TenderSearch> {
  try {
    return await post<TenderSearch>({ action: 'tenders', query, county, agpoCategory });
  } catch {
    return { tenders: [], note: 'Couldn’t search right now. Check your connection and try again.', mode: 'sample' };
  }
}
