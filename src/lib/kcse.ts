// KCSE grades: points, the mean grade estimate, and the usual KUCCPS minimum
// mean grade for each level. The result slip's mean grade always wins over
// this estimate.

export const grades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'] as const;
export type Grade = (typeof grades)[number];

export const gradePoints: Record<Grade, number> = {
  A: 12, 'A-': 11, 'B+': 10, B: 9, 'B-': 8, 'C+': 7, C: 6, 'C-': 5, 'D+': 4, D: 3, 'D-': 2, E: 1,
};

type Group = 'compulsory' | 'science' | 'humanity' | 'other';

export const kcseSubjects: { name: string; group: Group }[] = [
  { name: 'English', group: 'compulsory' },
  { name: 'Kiswahili', group: 'compulsory' },
  { name: 'Mathematics', group: 'compulsory' },
  { name: 'Biology', group: 'science' },
  { name: 'Chemistry', group: 'science' },
  { name: 'Physics', group: 'science' },
  { name: 'History', group: 'humanity' },
  { name: 'Geography', group: 'humanity' },
  { name: 'CRE', group: 'humanity' },
  { name: 'IRE', group: 'humanity' },
  { name: 'Business Studies', group: 'other' },
  { name: 'Agriculture', group: 'other' },
  { name: 'Computer Studies', group: 'other' },
  { name: 'Home Science', group: 'other' },
  { name: 'French', group: 'other' },
  { name: 'German', group: 'other' },
  { name: 'Art and Design', group: 'other' },
  { name: 'Music', group: 'other' },
];

export function cleanGrade(text: string): Grade | null {
  const g = text.trim().toUpperCase().replace(/\s+/g, '').replace('−', '-');
  return (grades as readonly string[]).includes(g) ? (g as Grade) : null;
}

// "English B+\nKiswahili B" <-> { English: 'B+', Kiswahili: 'B' }
export function parseGrades(text: string): Record<string, Grade> {
  const result: Record<string, Grade> = {};
  for (const line of (text ?? '').split(/\n|;|,/)) {
    const match = line.trim().match(/^(.+?)[\s:=-]+([A-E][+-]?)$/i);
    if (!match) continue;
    const grade = cleanGrade(match[2]);
    const subject = kcseSubjects.find((s) => s.name.toLowerCase() === match[1].trim().toLowerCase())?.name ?? match[1].trim();
    if (grade) result[subject] = grade;
  }
  return result;
}

export function formatGrades(values: Record<string, string>): string {
  return Object.entries(values)
    .filter(([, g]) => cleanGrade(g))
    .map(([subject, g]) => `${subject} ${cleanGrade(g)}`)
    .join('\n');
}

const meanBands: [number, Grade][] = [
  [81, 'A'], [74, 'A-'], [67, 'B+'], [60, 'B'], [53, 'B-'], [46, 'C+'], [39, 'C'], [32, 'C-'], [25, 'D+'], [18, 'D'], [11, 'D-'], [0, 'E'],
];

// Seven subjects: the three compulsory, the best two sciences, the best
// humanity, and the best of the rest.
export function estimateMean(values: Record<string, Grade>): { total: number; grade: Grade } | null {
  const points = (name: string) => gradePoints[values[name]] ?? 0;
  const taken = Object.keys(values).filter((name) => values[name]);
  const groupOf = (name: string) => kcseSubjects.find((s) => s.name === name)?.group ?? 'other';
  const compulsory = taken.filter((n) => groupOf(n) === 'compulsory');
  if (compulsory.length < 3 || taken.length < 7) return null;
  const best = (list: string[], count: number) => [...list].sort((a, b) => points(b) - points(a)).slice(0, count);
  const chosen = [...compulsory];
  chosen.push(...best(taken.filter((n) => groupOf(n) === 'science'), 2));
  chosen.push(...best(taken.filter((n) => groupOf(n) === 'humanity'), 1));
  const rest = taken.filter((n) => !chosen.includes(n));
  chosen.push(...best(rest, 7 - chosen.length));
  const total = chosen.slice(0, 7).reduce((sum, n) => sum + points(n), 0);
  const grade = meanBands.find(([min]) => total >= min)![1];
  return { total, grade };
}

export const levels = ['Degree', 'Diploma', 'Certificate', 'Artisan'] as const;
export type Level = (typeof levels)[number];

// The usual KUCCPS minimum mean grades; some courses ask for more.
export const levelMinimum: Record<Level, Grade> = { Degree: 'C+', Diploma: 'C-', Certificate: 'D', Artisan: 'E' };

export function meetsLevel(mean: Grade, level: Level) {
  return gradePoints[mean] >= gradePoints[levelMinimum[level]];
}
