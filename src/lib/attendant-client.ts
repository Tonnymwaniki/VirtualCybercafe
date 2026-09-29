import type { ChatMessage, ChatResponse } from '@/lib/chat-types';
import { sampleReply } from '@/lib/sample-attendant';
import { supabase } from '@/lib/supabase';

// Asks the server's /api/chat route; falls back to local sample replies when
// the server can't be reached (for example, a build without the API server).
// taskId narrows the attendant to one Government Services task.
export async function askAttendant(messages: ChatMessage[], taskId?: string): Promise<ChatResponse> {
  try {
    // Lets the attendant look inside the signed-in user's Locker.
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ messages: messages.map(({ role, text }) => ({ role, text })), taskId }),
    });
    if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
    return (await response.json()) as ChatResponse;
  } catch {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    return { ...sampleReply(lastUser?.text ?? ''), mode: 'sample' };
  }
}
