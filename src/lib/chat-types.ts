export type ChatRole = 'user' | 'assistant';

// Things the attendant hands back, shown as cards under its reply.
export type ChatAction =
  | { type: 'open'; label: string; route: string }
  | { type: 'document'; title: string; body: string }
  | { type: 'link'; label: string; url: string }
  | { type: 'checklist'; title: string; items: string[] }
  | { type: 'steps'; title: string; steps: string[] }
  | { type: 'fee'; amount: string; note: string; source: string }
  | { type: 'warning'; text: string };

export type ChatMessage = {
  id?: string;
  role: ChatRole;
  text: string;
  actions?: ChatAction[];
  // When it was sent (ISO).
  at?: string;
  // A photo sent with the message: shown from the phone while the chat is
  // open; only `hadImage` is kept in the saved history.
  imageUri?: string;
  hadImage?: boolean;
  // The message could not be sent; the chat offers a retry.
  failed?: boolean;
};

export type ChatResponse = {
  reply: string;
  actions: ChatAction[];
  // "sample" until an Anthropic API key is configured on the server.
  // "local" when the phone answered from the catalogue without the AI.
  mode: 'ai' | 'sample' | 'local';
  // Set when the daily AI allowance is used up.
  limited?: boolean;
  // The server couldn't be reached; the user message can be retried.
  offline?: boolean;
};

// A saved conversation, listed in the chat history panel.
export type Conversation = {
  id: string;
  title: string;
  pinned?: boolean;
  // The guided task or screen the chat was opened from, if any.
  taskId?: string;
  screen?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export const CHAT_KEY = 'chat:';
