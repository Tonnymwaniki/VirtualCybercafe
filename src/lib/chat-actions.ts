// Carries out the actions the attendant offers in chat (see ProposedAction),
// once the user taps "Do it", and undoes them. Everything runs on the phone
// with the user's own session, like the app's screens.

import { findGovTask, type GovTaskId } from '@/data/gov-tasks';
import type { ActionState, ProposedAction } from '@/lib/chat-types';
import { loadAllProgress, saveProgress } from '@/lib/gov-store';
import { emptyProgress, type TaskProgress } from '@/lib/gov-types';
import { deleteJob, newJob, saveJob } from '@/lib/jobs-store';
import { loadProfile, saveProfile } from '@/lib/profile-store';
import { deleteRecord, newId, saveRecord } from '@/lib/record-store';
import { TRIP_KEY, type Trip } from '@/lib/travel-types';

// Reminders show under "Continue" on Home until their date has passed.
export const REMINDER_KEY = 'remind:';

export type Reminder = { id: string; title: string; date: string; route: string; createdAt: string };

// Locker files whose names start with the requirement's lockerName.
export function readyFromLocker(taskId: string, lockerNames: string[]) {
  const task = findGovTask(taskId);
  if (!task) return [];
  const names = lockerNames.map((name) => name.toLowerCase());
  return task.requirements
    .filter((r) => r.lockerName && names.some((name) => name.startsWith(r.lockerName!)))
    .map((r) => r.id);
}

export async function runAction(userId: string, action: ProposedAction, lockerNames: string[]): Promise<ActionState> {
  switch (action.kind) {
    case 'details': {
      const before = await loadProfile(userId);
      const changes = Object.fromEntries(action.fields.map((f) => [f.key, f.value]));
      await saveProfile(userId, changes);
      const previous = Object.fromEntries(action.fields.map((f) => [f.key, before[f.key] ?? '']));
      return { status: 'done', undo: { previous }, route: '/profile' };
    }
    case 'task': {
      const taskId = action.taskId as GovTaskId;
      const before = (await loadAllProgress(userId))[taskId];
      const found = readyFromLocker(taskId, lockerNames);
      const current: TaskProgress = before ?? emptyProgress;
      const next: TaskProgress = {
        ...current,
        ready: [...new Set([...current.ready, ...found])],
        answers: { ...current.answers, ...Object.fromEntries(action.answers.map((a) => [a.key, a.value])) },
      };
      await saveProgress(userId, taskId, next);
      return {
        status: 'done',
        undo: { previous: before ?? null },
        route: `/gov/${taskId}`,
        note: String(found.length),
      };
    }
    case 'job': {
      const job = await saveJob(userId, newJob(action.advert));
      return { status: 'done', undo: { id: job.id }, route: `/jobs/${job.id}` };
    }
    case 'trip': {
      const trip: Trip = {
        id: newId(),
        destination: action.destination,
        purpose: action.purpose,
        departDate: action.departDate,
        returnDate: action.returnDate,
        check: null,
        ready: [],
        stage: -1,
        formAnswers: {},
        letters: {},
        createdAt: new Date().toISOString(),
      };
      await saveRecord(userId, TRIP_KEY, trip.id, trip);
      return { status: 'done', undo: { id: trip.id }, route: `/travel/trip/${trip.id}` };
    }
    case 'reminder': {
      const reminder: Reminder = { id: newId(), title: action.title, date: action.date, route: action.route, createdAt: new Date().toISOString() };
      await saveRecord(userId, REMINDER_KEY, reminder.id, reminder);
      return { status: 'done', undo: { id: reminder.id }, route: action.route || undefined };
    }
  }
}

export async function undoAction(userId: string, action: ProposedAction, state: ActionState): Promise<ActionState> {
  const undo = state.undo ?? {};
  switch (action.kind) {
    case 'details':
      // An empty value clears a detail that wasn't there before.
      await saveProfile(userId, (undo.previous ?? {}) as Record<string, string>);
      break;
    case 'task':
      await saveProgress(userId, action.taskId as GovTaskId, (undo.previous as TaskProgress | null) ?? emptyProgress);
      break;
    case 'job':
      await deleteJob(userId, String(undo.id));
      break;
    case 'trip':
      await deleteRecord(userId, TRIP_KEY, String(undo.id));
      break;
    case 'reminder':
      await deleteRecord(userId, REMINDER_KEY, String(undo.id));
      break;
  }
  return { status: 'undone' };
}
