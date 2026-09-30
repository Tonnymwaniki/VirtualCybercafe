// Rule-based Education helpers used until the AI key is set, plus the
// payment check every admission letter gets.

import type { AdmissionLetter, CourseQuery, CourseSearch, DemandReport } from '@/lib/edu-types';
import { findDate } from '@/lib/jobs-sample';
import { cleanGrade, levelMinimum, levels, meetsLevel } from '@/lib/kcse';

// Colleges are paid through their bank account or paybill, never a personal number.
export function letterWarnings(text: string): string[] {
  const warnings: string[] = [];
  if (/\b(send|pay|deposit)\b[^.\n]{0,60}\b(0|\+?254)[17]\d{8}\b/i.test(text) || /\b(0|\+?254)[17]\d{8}\b[^.\n]{0,40}\b(send money|pochi|m-?pesa number)\b/i.test(text)) {
    warnings.push('It asks you to send fees to a personal phone number. Pay only to the institution’s bank account or official paybill.');
  }
  if (/\b(pay|send)\b[^.\n]{0,40}\b(to secure|to confirm|to reserve)\b[^.\n]{0,20}\b(slot|place|admission)\b/i.test(text)) {
    warnings.push('It asks for money to “secure” your place. Check with the institution directly before paying.');
  }
  return warnings;
}

const amount = /(?:ksh\.?|kes|sh\.?)?\s*([\d]{1,3}(?:,\d{3})+|\d{3,7})(?:\.\d{2})?\s*$/i;

export function sampleLetter(text: string): AdmissionLetter {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fees: AdmissionLetter['fees'] = [];
  let total = '';
  for (const line of lines) {
    const match = line.match(amount);
    if (!match || line.length > 90) continue;
    const item = line.slice(0, match.index).replace(/[.:\-–\s]+$/, '').trim();
    if (!item) continue;
    if (/^total/i.test(item)) total = `KSh ${match[1]}`;
    else fees.push({ item, amount: `KSh ${match[1]}` });
  }
  const reportingLine = lines.find((l) => /report/i.test(l)) ?? '';
  const bringStart = lines.findIndex((l) => /bring|requirements|you will need/i.test(l));
  const toBring = bringStart >= 0
    ? lines.slice(bringStart + 1).filter((l) => /^([-*•]|\d+[.)])\s+/.test(l)).map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, '')).slice(0, 20)
    : [];
  return {
    institution: lines[0]?.slice(0, 120) ?? '',
    course: (lines.find((l) => /course|programme|program/i.test(l)) ?? '').replace(/^[^:]*:\s*/, '').slice(0, 160),
    reportingDate: findDate(reportingLine) || findDate(text),
    reportingText: reportingLine.slice(0, 200),
    fees,
    total,
    payment: (lines.find((l) => /account|paybill|bank/i.test(l)) ?? '').slice(0, 300),
    toBring,
    notes: [],
    warnings: letterWarnings(text),
  };
}

export function sampleCourses(query: CourseQuery): CourseSearch {
  const mean = cleanGrade(query.meanGrade);
  const open = mean ? levels.filter((level) => meetsLevel(mean, level)) : [];
  const note = mean
    ? `With a mean grade of ${mean} you meet the usual minimum for: ${open.join(', ') || 'none of the levels'} (degree needs ${levelMinimum.Degree}, diploma ${levelMinimum.Diploma}). The course search switches on with the AI; for now, search courses on the KUCCPS portal.`
    : 'Add your KCSE mean grade first. The course search switches on with the AI.';
  return { courses: [], note, mode: 'sample' };
}

export function sampleDemand(): DemandReport {
  return {
    courses: [],
    summary: 'The live job market check switches on with the AI. For now, search the course’s job titles on BrighterMonday, MyJobMag or the Public Service Commission.',
    alternatives: [],
    sources: [],
    checkedAt: new Date().toISOString(),
    mode: 'sample',
  };
}
