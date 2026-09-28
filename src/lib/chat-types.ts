export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  text: string;
};

export type ChatResponse = {
  reply: string;
  // "sample" until an Anthropic API key is configured on the server.
  mode: 'ai' | 'sample';
};
