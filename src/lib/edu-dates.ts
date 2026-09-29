import { daysLeft } from '@/lib/jobs-store';

export function reportingLabel(date: string): string {
  const days = daysLeft(date);
  if (days === null) return 'Reporting date not found';
  if (days < 0) return 'Reporting date passed';
  if (days === 0) return 'Report today';
  if (days === 1) return 'Report tomorrow';
  return `Report in ${days} days`;
}
