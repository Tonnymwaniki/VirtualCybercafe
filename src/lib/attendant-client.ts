import { apiFetch } from '@/lib/api';
import type { ChatMessage, ChatResponse } from '@/lib/chat-types';
import { sampleReply } from '@/lib/sample-attendant';
import { supabase } from '@/lib/supabase';

// Asks the server's /api/chat route; falls back to local sample replies when
// the server can't be reached (for example, a build without the API server).
// taskId narrows the attendant to one guided task; screen is the path of the
// screen whose "Help me here" button opened the chat.
export async function askAttendant(
  messages: ChatMessage[],
  taskId?: string,
  screen?: string,
  language: 'en' | 'sw' = 'en',
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
      body: JSON.stringify({ messages: messages.map(({ role, text }) => ({ role, text })), taskId, screen, language }),
    });
    if (response.status === 429) {
      const body = (await response.json()) as { error?: string };
      return { reply: body.error ?? 'The AI helper is resting for today.', actions: [], mode: 'ai', limited: true };
    }
    if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
    return (await response.json()) as ChatResponse;
  } catch {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    return { ...sampleReply(lastUser?.text ?? '', language), mode: 'sample' };
  }
}
