import { apiFetch } from '@/lib/api';
import type { ChatMessage, ChatResponse, FileMeta } from '@/lib/chat-types';
import { supabase } from '@/lib/supabase';

// Asks the server's /api/chat route. taskId narrows the attendant to one
// guided task; screen is the path of the screen whose "Help me here" button
// opened the chat; image is a JPEG (base64) sent with the last message.
// When the server can't be reached the answer comes back with
// `offline: true` and the chat offers a retry. files describes the files in
// the chat (they stay on the phone); pdf is a PDF (base64) sent with the
// last message, for the attendant to read.
export async function askAttendant(
  messages: ChatMessage[],
  taskId?: string,
  screen?: string,
  language: 'en' | 'sw' = 'en',
  image?: string,
  files: (FileMeta & { newest?: boolean })[] = [],
  pdf?: string,
): Promise<ChatResponse> {
  try {
    // Lets the attendant look inside the signed-in user's Locker.
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    const response = await apiFetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        messages: messages.map(({ role, text, hadImage, imageUri, files: sent, actions }) => ({
          role,
          text: withFiles(text, sent, actions),
          ...((hadImage || imageUri) && !sent?.length ? { hadImage: true } : {}),
        })),
        taskId,
        screen,
        language,
        ...(image ? { image } : {}),
        ...(files.length ? { files } : {}),
        ...(pdf ? { pdf } : {}),
      }),
    });
    if (response.status === 429 || response.status === 413) {
      const body = (await response.json()) as { error?: string };
      return {
        reply: body.error ?? 'The AI helper is resting for today.',
        actions: [],
        mode: 'ai',
        limited: response.status === 429,
      };
    }
    if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
    return (await response.json()) as ChatResponse;
  } catch {
    return { reply: '', actions: [], mode: 'sample', offline: true };
  }
}

// Names the files sent with a message, and the files the phone made for a
// reply, so the attendant can follow the conversation.
function withFiles(text: string, sent?: FileMeta[], actions?: ChatMessage['actions']) {
  const made = (actions ?? []).flatMap((a) => (a.type === 'work' && a.outcome?.status === 'done' ? a.outcome.outputs.map((o) => o.file) : []));
  const parts = [
    ...(sent?.length ? [`[Sent: ${sent.map((f) => `${f.name} (${f.id})`).join(', ')}]`] : []),
    text,
    ...(made.length ? [`[The phone made: ${made.map((f) => `${f.name} (${f.id})`).join(', ')}]`] : []),
    ...((actions ?? []).some((a) => a.type === 'task') ? ['[Job application card shown]'] : []),
  ];
  return parts.filter(Boolean).join(' ');
}
