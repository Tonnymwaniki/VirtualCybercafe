// Applications being prepared in Form Intelligence, kept as "form:<id>" rows
// in the private task_progress table (lib/record-store.ts), so no new table
// is needed. A new one starts filled from My Details.

import type { Profile } from '@/data/profile-fields';
import { allFields, isFileField, type FormEntry, type FormSchema } from '@/lib/forms/schema';
import { loadProfile, saveProfile } from '@/lib/profile-store';
import { deleteRecord, loadRecords, newId, saveRecord } from '@/lib/record-store';

const PREFIX = 'form:';

const listeners = new Set<() => void>();

export function onFormsChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const changed = () => listeners.forEach((listener) => listener());

export async function loadEntries(userId: string): Promise<FormEntry[]> {
  const records = await loadRecords<FormEntry>(userId, PREFIX);
  return Object.values(records).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadEntry(userId: string, id: string): Promise<FormEntry | undefined> {
  return (await loadRecords<FormEntry>(userId, PREFIX))[id];
}

export async function saveEntry(userId: string, entry: FormEntry): Promise<FormEntry> {
  const saved = { ...entry, updatedAt: new Date().toISOString() };
  await saveRecord(userId, PREFIX, entry.id, saved);
  changed();
  return saved;
}

export async function deleteEntry(userId: string, id: string) {
  await deleteRecord(userId, PREFIX, id);
  changed();
}

// Answers the form can take from My Details, for fields still empty.
export function fromProfile(schema: FormSchema, entry: Pick<FormEntry, 'answers'>, profile: Profile) {
  const answers: Record<string, string> = {};
  for (const field of allFields(schema)) {
    if (isFileField(field) || !field.profileKey) continue;
    const value = profile[field.profileKey]?.trim();
    if (value && !entry.answers[field.id]?.trim()) answers[field.id] = value;
  }
  return answers;
}

export async function startEntry(
  userId: string,
  schema: FormSchema,
  about: { title?: string; jobId?: string; deadline?: string } = {},
): Promise<FormEntry> {
  const profile = await loadProfile(userId);
  const answers = fromProfile(schema, { answers: {} }, profile);
  const now = new Date().toISOString();
  const entry: FormEntry = {
    id: newId(),
    formId: schema.id,
    title: about.title || schema.title,
    jobId: about.jobId,
    deadline: about.deadline,
    answers,
    sourceOf: Object.fromEntries(Object.keys(answers).map((key) => [key, 'profile' as const])),
    files: {},
    createdAt: now,
    updatedAt: now,
  };
  return saveEntry(userId, entry);
}

// Typed answers that belong in My Details go back there, so every form reuses them.
export async function saveAnswersToProfile(userId: string, schema: FormSchema, entry: FormEntry) {
  const changes: Profile = {};
  for (const field of allFields(schema)) {
    const value = entry.answers[field.id]?.trim();
    if (field.profileKey && value) changes[field.profileKey] = value;
  }
  if (Object.keys(changes).length) await saveProfile(userId, changes);
}
