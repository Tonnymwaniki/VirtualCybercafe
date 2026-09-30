// One sentence on why a request to the app's server failed and what to do,
// in the language picked. Used where a service falls back to a simple draft
// or an empty result, so the person knows it wasn't their fault (or was).

import { ApiError } from '@/lib/api';
import { isNetworkError } from '@/lib/connection';
import { activeLanguage, translate, type TextKey } from '@/lib/i18n';

export type FailureKind = 'offline' | 'limit' | 'sign_in' | 'too_big' | 'server' | 'timeout' | 'unknown';

export function failureKind(error: unknown): FailureKind {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'limit';
    if (error.status === 401) return 'sign_in';
    if (error.status === 413) return 'too_big';
    return error.status >= 500 ? 'server' : 'unknown';
  }
  if (isNetworkError(error)) return 'offline';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (/timed? ?out|timeout|abort/.test(message)) return 'timeout';
  if (/network|fetch|offline|internet/.test(message)) return 'offline';
  return 'unknown';
}

// "Couldn't search right now." + why + what to do.
export function failureText(lead: string, error: unknown) {
  const kind = failureKind(error);
  const status = error instanceof ApiError ? error.status : '';
  // The server's own words say why (e.g. "Today's AI limit is reached").
  const server = error instanceof ApiError && error.fromServer && kind === 'limit' ? `${error.message} ` : '';
  return `${lead} ${server}${translate(activeLanguage(), `fail.${kind}` as TextKey, { status })}`.trim();
}
