import type { AppToolId } from '@/data/guides';

export type ChatRole = 'user' | 'assistant';

// Things the attendant hands back for the user to tap.
export type ChatAction =
  | { type: 'open'; tool: AppToolId; label: string; route: string }
  | { type: 'document'; title: string; body: string }
  | { type: 'link'; label: string; url: string };

export type ChatMessage = {
  role: ChatRole;
  text: string;
  actions?: ChatAction[];
};

export type ChatResponse = {
  reply: string;
  actions: ChatAction[];
  // "sample" until an Anthropic API key is configured on the server.
  mode: 'ai' | 'sample';
};
