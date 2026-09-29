// "I need to apply for a job" starts the job application card straight away,
// free, without asking the AI. A pasted advert (long text) goes to the
// attendant, which reads it and offers to save it.

import { isLiveWorkspace } from '@/data/launch';
import type { ChatAction } from '@/lib/chat-types';
import { newId } from '@/lib/record-store';

const APPLY =
  /\b(apply|applying|application)\b[^.?!]{0,40}\b(job|jobs|position|post|vacancy|vacancies|kazi)\b|\b(job|kazi)\b[^.?!]{0,20}\bapplication\b|\b(kuomba|omba|naomba|nataka kuomba)\s+kazi\b/i;

export function taskIntent(text: string, language: 'en' | 'sw'): { reply: string; actions: ChatAction[] } | null {
  if (!isLiveWorkspace('jobs') || text.length > 160 || !APPLY.test(text)) return null;
  const sw = language === 'sw' || /\b(kazi|kuomba|nataka)\b/i.test(text);
  return {
    reply: sw
      ? 'Sawa, tufanye hatua kwa hatua. Hii ndiyo orodha ya ombi lako la kazi. Bandika tangazo la kazi hapa, tuma picha yake, au chagua kazi uliyohifadhi.'
      : 'Let’s do it step by step. Here’s your job application. Paste the advert here, send a photo of it, or pick a job you saved.',
    actions: [{ type: 'task', id: newId(), task: 'job_application', createdAt: new Date().toISOString() }],
  };
}
