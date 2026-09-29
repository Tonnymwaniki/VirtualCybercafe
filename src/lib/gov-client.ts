import { findGovTask, type GovTaskId } from '@/data/gov-tasks';
import { apiFetch } from '@/lib/api';
import type { HelperRequest, HelperResponse, IdReadResult, RequirementsCheck } from '@/lib/gov-types';

async function post<T>(body: object, path = '/api/gov'): Promise<T> {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as T;
}

// Falls back to the built-in list when the server can't be reached.
export async function fetchRequirements(taskId: GovTaskId, refresh = false): Promise<RequirementsCheck> {
  try {
    return await post<RequirementsCheck>({ action: 'requirements', taskId, refresh });
  } catch {
    const task = findGovTask(taskId)!;
    return {
      items: task.requirements.map((r) => ({ label: r.label, note: '' })),
      fee: task.payment.free ? 'Free' : 'Shown on the official site when you apply',
      where: task.agency,
      steps: task.steps,
      sources: [],
      checkedAt: new Date().toISOString(),
      mode: 'sample',
    };
  }
}

export async function readIdCard(base64: string): Promise<IdReadResult> {
  try {
    return await post<IdReadResult>({ action: 'read_id', image: base64, mediaType: 'image/jpeg' });
  } catch {
    return { details: {}, problems: ['Couldn’t reach the ID reader. Type your details below.'], mode: 'sample' };
  }
}

export async function askFormHelper(request: HelperRequest): Promise<HelperResponse> {
  try {
    return await post<HelperResponse>(request, '/api/form-helper');
  } catch {
    return {
      reply: 'I couldn’t reach the helper. Check your connection and try again.',
      updates: [],
      actions: [],
      mode: 'sample',
    };
  }
}
