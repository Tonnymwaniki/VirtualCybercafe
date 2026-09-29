// Saved attendant chats, kept as task_progress rows "chat:<id>" for a
// signed-in user (so they follow the account to another phone) and on this
// device for guests. Photos are not saved, only the note that one was sent.

import type { ChatMessage, Conversation } from '@/lib/chat-types';
import { CHAT_KEY } from '@/lib/chat-types';
import { deleteRecord, loadRecords, newId, saveRecord } from '@/lib/record-store';

// The longest chat kept; older messages drop off the top.
const MAX_MESSAGES = 60;

export async function loadConversations(userId: string): Promise<Conversation[]> {
  const records = await loadRecords<Conversation>(userId, CHAT_KEY);
  return Object.values(records)
    .filter((c) => c && Array.isArray(c.messages))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function forStorage(message: ChatMessage): ChatMessage {
  const { imageUri, failed, ...rest } = message;
  return imageUri ? { ...rest, hadImage: true } : rest;
}

export async function saveConversation(userId: string, conversation: Conversation): Promise<void> {
  const messages = conversation.messages.filter((m) => !m.failed).slice(-MAX_MESSAGES).map(forStorage);
  if (!messages.length) return;
  await saveRecord(userId, CHAT_KEY, conversation.id, { ...conversation, messages });
}

export function deleteConversation(userId: string, id: string) {
  return deleteRecord(userId, CHAT_KEY, id);
}

export function newConversation(taskId?: string, screen?: string): Conversation {
  const now = new Date().toISOString();
  return { id: newId(), title: '', taskId, screen, messages: [], createdAt: now, updatedAt: now };
}

// A short title from the first thing the user asked, made on the phone.
export function titleFrom(text: string, hadImage = false) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return hadImage ? 'Photo' : 'New chat';
  const first = clean.split(/(?<=[.?!])\s/)[0];
  const title = first.length > 42 ? `${first.slice(0, 40).replace(/\s+\S*$/, '')}…` : first;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export type DayGroup = 'today' | 'yesterday' | 'week' | 'older';

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dayGroup(iso: string, now = new Date()): DayGroup {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'week';
  return 'older';
}

export function sameDay(a: string, b: string) {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

export function clockTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
