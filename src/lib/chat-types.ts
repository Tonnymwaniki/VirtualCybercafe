export type ChatRole = 'user' | 'assistant';

// Things the attendant hands back for the user to tap.
export type ChatAction =
  | { type: 'open'; label: string; route: string }
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
  // "local" when the phone answered from the catalogue without the AI.
  mode: 'ai' | 'sample' | 'local';
  // Set when the daily AI allowance is used up.
  limited?: boolean;
};
