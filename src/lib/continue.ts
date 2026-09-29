// Unfinished work across the app, for the "Continue" row on Home: guided
// tasks, trips, jobs and tenders, each with its next step.

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { findGovTask, type GovTaskId } from '@/data/gov-tasks';
import { isLivePath } from '@/data/launch';
import { taskColors } from '@/data/task-colors';
import { tripStages } from '@/data/visa-form';
import { TENDER_KEY, tenderStatuses, type SavedTender } from '@/lib/biz-types';
import { REMINDER_KEY, type Reminder } from '@/lib/chat-actions';
import { loadAllProgress } from '@/lib/gov-store';
import { loadJobs } from '@/lib/jobs-store';
import { jobStatuses } from '@/lib/jobs-types';
import { loadRecords } from '@/lib/record-store';
import { daysToTrip } from '@/lib/travel-sample';
import { TRIP_KEY, type Trip } from '@/lib/travel-types';

export type ContinueItem = {
  id: string;
  title: string;
  // The next stage's name, or '' when the work has only just started.
  next: string;
  route: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  // For the trip title, which is translated on screen.
  place?: string;
  // A reminder's date (YYYY-MM-DD), shown as "Due ..." instead of a next step.
  due?: string;
  at: string;
};

export async function loadContinueItems(userId: string, limit = 3): Promise<ContinueItem[]> {
  const [reminders, progress, jobs, trips, tenders] = await Promise.all([
    loadRecords<Reminder>(userId, REMINDER_KEY),
    loadAllProgress(userId),
    loadJobs(userId),
    loadRecords<Trip>(userId, TRIP_KEY),
    loadRecords<SavedTender>(userId, TENDER_KEY),
  ]);
  const items: ContinueItem[] = [];

  for (const [id, saved] of Object.entries(progress)) {
    const task = findGovTask(id);
    if (!task || !saved) continue;
    const started = saved.stage >= 0 || saved.ready.length > 0 || Object.keys(saved.answers).length > 0;
    if (!started || saved.stage >= task.stages.length - 1) continue;
    items.push({
      id: `task:${id}`,
      title: task.title,
      next: task.stages[saved.stage + 1],
      route: `/gov/${id}`,
      icon: task.icon,
      color: taskColors[id as GovTaskId] ?? '#2563EB',
      at: saved.updatedAt,
    });
  }

  for (const trip of Object.values(trips)) {
    const days = daysToTrip(trip.departDate);
    if ((days !== null && days < 0) || trip.stage >= tripStages.length - 1) continue;
    items.push({
      id: `trip:${trip.id}`,
      title: trip.destination,
      place: trip.destination,
      next: tripStages[trip.stage + 1],
      route: `/travel/trip/${trip.id}`,
      icon: 'airplane',
      color: '#6366F1',
      at: trip.createdAt,
    });
  }

  for (const job of jobs) {
    if (job.closed || job.status < 0 || job.status >= jobStatuses.length - 1) continue;
    if (job.advert.deadline && job.status === 0 && job.advert.deadline < new Date().toISOString().slice(0, 10)) continue;
    items.push({
      id: `job:${job.id}`,
      title: job.advert.title,
      next: jobStatuses[job.status + 1],
      route: `/jobs/${job.id}`,
      icon: 'briefcase',
      color: '#EF4444',
      at: job.updatedAt || job.createdAt,
    });
  }

  for (const saved of Object.values(tenders)) {
    // Submitted, won or not successful: nothing left to prepare.
    if (saved.status >= 2) continue;
    if (saved.tender.closingDate && saved.tender.closingDate < new Date().toISOString().slice(0, 10)) continue;
    items.push({
      id: `tender:${saved.id}`,
      title: saved.tender.title,
      next: tenderStatuses[saved.status + 1],
      route: `/business/tender/${saved.id}`,
      icon: 'document-text',
      color: '#22C55E',
      at: saved.createdAt,
    });
  }

  // Reminders from the chat come first, soonest first, until their day passes.
  const today = new Date().toISOString().slice(0, 10);
  const due: ContinueItem[] = Object.values(reminders)
    .filter((r) => r && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      id: `remind:${r.id}`,
      title: r.title,
      next: '',
      due: r.date,
      route: r.route && isLivePath(r.route) ? r.route : '/chat',
      icon: 'alarm',
      color: '#F59E0B',
      at: r.createdAt,
    }));

  const live = items.filter((item) => isLivePath(item.route));
  return [...due, ...live.sort((a, b) => (b.at || '').localeCompare(a.at || ''))].slice(0, limit);
}

// "30 Oct" for a YYYY-MM-DD date.
export function shortDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
