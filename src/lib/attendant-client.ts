import type { ChatMessage, ChatResponse } from '@/lib/chat-types';
import { sampleReply } from '@/lib/sample-attendant';

// Asks the server's /api/chat route; falls back to local sample replies when
// the server can't be reached (for example, a build without the API server).
export async function askAttendant(messages: ChatMessage[]): Promise<ChatResponse> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
    return (await response.json()) as ChatResponse;
  } catch {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    return { reply: sampleReply(lastUser?.text ?? ''), mode: 'sample' };
  }
}
