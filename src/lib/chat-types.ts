import type { JobAdvert } from '@/lib/jobs-types';
import type { TripPurpose } from '@/lib/travel-types';

export type ChatRole = 'user' | 'assistant';

type LabeledValue = { key: string; label: string; value: string };

// Something the attendant offers to do in the app. Nothing changes until the
// user taps "Do it" on its card (see lib/chat-actions.ts).
export type ProposedAction =
  | { kind: 'details'; fields: LabeledValue[] }
  | { kind: 'task'; taskId: string; title: string; answers: LabeledValue[] }
  | { kind: 'job'; advert: JobAdvert }
  | { kind: 'trip'; destination: string; purpose: TripPurpose; departDate: string; returnDate: string }
  | { kind: 'reminder'; title: string; date: string; route: string };

export type ActionState = {
  status: 'done' | 'undone' | 'dismissed';
  // What Undo needs, and where to go afterwards.
  undo?: Record<string, unknown>;
  route?: string;
  note?: string;
};

// A file in the chat: sent by the person or made by the Workbench. The bytes
// stay on the phone (lib/chat-files.ts); only this description is sent to
// the server and kept in the saved chat.
export type FileMeta = {
  id: string;
  name: string;
  kind: 'pdf' | 'image';
  bytes: number;
  pages?: number;
  width?: number;
  height?: number;
};

// Workbench work the attendant (or the phone's own quick matcher) asks for.
// It runs on the phone as soon as the reply arrives; it only makes new
// files, so it needs no "Do it".
export type WorkRequest =
  | { op: 'shrink'; fileIds: string[]; maxKB: number }
  | { op: 'resize'; fileIds: string[]; width: number; height: number; exact: boolean; maxKB?: number }
  | { op: 'to_pdf'; fileIds: string[]; maxKB?: number }
  | { op: 'pick_pages'; fileIds: string[]; pages: string }
  | { op: 'to_jpg'; fileIds: string[]; pages?: string }
  | { op: 'check_rule'; fileIds: string[]; ruleId: string }
  | { op: 'scan'; fileIds: string[]; look: 'clean' | 'bw' | 'enhance' };

export type WorkOutcome = {
  status: 'done' | 'failed';
  // The new files, with what was measured on each.
  outputs: { file: FileMeta; checks: { ok: boolean; label: string }[] }[];
  notes: string[];
  error?: string;
};

// Things the attendant hands back, shown as cards under its reply.
export type ChatAction =
  | { type: 'open'; label: string; route: string }
  | { type: 'document'; title: string; body: string }
  | { type: 'link'; label: string; url: string }
  | { type: 'checklist'; title: string; items: string[] }
  | { type: 'steps'; title: string; steps: string[] }
  | { type: 'fee'; amount: string; note: string; source: string }
  | { type: 'warning'; text: string }
  | { type: 'confirm'; id: string; action: ProposedAction; state?: ActionState }
  | { type: 'work'; id: string; request: WorkRequest; outcome?: WorkOutcome };

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
  // Files sent with the message.
  files?: FileMeta[];
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
