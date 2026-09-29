// Rule-based Jobs helpers used until the AI key is set, and the pieces both
// the AI and the rules share.

import { sampleCv, type CvAnswers } from '@/lib/cv';
import { mergeSignals, scamSignals } from '@/lib/job-scam';
import type {
  ApplyMethod,
  Candidate,
  InterviewQuestion,
  JobAdvert,
  MatchResult,
  TailoredApplication,
} from '@/lib/jobs-types';

export function emptyAdvert(): JobAdvert {
  return {
    title: '',
    employer: '',
    location: '',
    deadline: '',
    deadlineText: '',
    salary: '',
    howToApply: { method: 'unknown', email: '', url: '', instructions: '' },
    requirements: [],
    duties: [],
    documents: [],
    scamSignals: [],
    sourceUrl: '',
  };
}

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Finds a date like "30th October 2026", "30/10/2026" or "2026-10-30".
export function findDate(text: string): string {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const slash = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  const words = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9}),?\s+(20\d{2})\b/i);
  if (words) {
    const month = months.indexOf(words[2].slice(0, 3).toLowerCase());
    if (month >= 0) return `${words[3]}-${String(month + 1).padStart(2, '0')}-${words[1].padStart(2, '0')}`;
  }
  return '';
}

const bullet = /^([-*•·▪●]|\d+[.)]|[a-z][.)])\s+/i;
const requirementWords = /degree|diploma|certificate|kcse|experience|years|skills?|knowledge|ability|proficien|must|licen[cs]e|qualification/i;

// Splits the advert's bullet points into requirements and duties, using the
// headings above them when there are any.
function bulletLists(text: string) {
  const requirements: string[] = [];
  const duties: string[] = [];
  let section: 'req' | 'duty' | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (!bullet.test(line)) {
      if (/^(requirements|qualifications|minimum requirements|who we are looking for|skills|person specification)/i.test(line)) section = 'req';
      else if (/^(duties|responsibilities|key responsibilities|job purpose|the role)/i.test(line)) section = 'duty';
      else if (line.length < 40 && line.endsWith(':')) section = null;
      continue;
    }
    const item = line.replace(bullet, '');
    if (section === 'req' || (!section && requirementWords.test(item))) requirements.push(item);
    else duties.push(item);
  }
  return { requirements: requirements.slice(0, 12), duties: duties.slice(0, 10) };
}

// Reads the obvious parts of a pasted advert with simple rules.
export function sampleAdvert(text: string, sourceUrl = ''): JobAdvert {
  const advert = emptyAdvert();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const titleLine =
    lines.find((l) => /^(job\s+title|position|role|vacancy)\s*[:\-]/i.test(l))?.replace(/^[^:\-]+[:\-]\s*/, '') ?? lines[0] ?? '';
  advert.title = titleLine.slice(0, 120);
  advert.employer = (lines.find((l) => /^(employer|company|organisation|organization)\s*:/i.test(l)) ?? '').replace(/^[^:]+:\s*/, '');
  advert.location = (lines.find((l) => /^(location|duty station|county)\s*:/i.test(l)) ?? '').replace(/^[^:]+:\s*/, '');
  const deadlineLine = lines.find((l) => /deadline|closing date|not later than|on or before|by\s+\d/i.test(l)) ?? '';
  advert.deadline = findDate(deadlineLine) || findDate(text);
  advert.deadlineText = deadlineLine.slice(0, 160);
  advert.salary = (lines.find((l) => /salary|ksh|kes|remuneration/i.test(l) && !/fee/i.test(l)) ?? '').slice(0, 120);

  const email = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] ?? '';
  const url = text.match(/https?:\/\/[^\s)]+/)?.[0] ?? sourceUrl;
  const method: ApplyMethod = email ? 'email' : url ? 'portal' : /hand\s*deliver|in person/i.test(text) ? 'in_person' : /p\.?\s?o\.?\s?box/i.test(text) ? 'post' : 'unknown';
  const howLine = lines.find((l) => /apply|application|send your|submit/i.test(l)) ?? '';
  advert.howToApply = { method, email, url, instructions: howLine.slice(0, 300) };

  Object.assign(advert, bulletLists(text));
  advert.documents = ['CV', 'Cover letter', 'Copy of National ID', 'Academic certificates'].filter((doc) =>
    doc === 'CV' || doc === 'Cover letter' ? true : new RegExp(doc.split(' ').pop()!, 'i').test(text),
  );
  advert.scamSignals = scamSignals(text, email);
  advert.sourceUrl = sourceUrl;
  return advert;
}

export function withScamCheck(advert: JobAdvert, sourceText: string): JobAdvert {
  const text = [sourceText, advert.howToApply.instructions, ...advert.requirements, ...advert.documents].join('\n');
  return { ...advert, scamSignals: mergeSignals(advert.scamSignals, scamSignals(text, advert.howToApply.email)) };
}

function words(text: string) {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w.length > 3 && !['with', 'from', 'have', 'must', 'will', 'able', 'good', 'years', 'year'].includes(w)),
  );
}

// Which Locker files look like each document the advert asks for.
export function documentsInLocker(advert: JobAdvert, lockerFiles: string[]) {
  const names = lockerFiles.map((f) => f.toLowerCase());
  return advert.documents.map((name) => {
    const key = name.toLowerCase();
    const inLocker =
      key.includes('cv') || key.includes('cover letter')
        ? true
        : names.some((file) =>
            key.includes('id')
              ? /(^|[^a-z])id|national/.test(file)
              : [...words(key)].some((w) => file.includes(w)) || (key.includes('certificate') && file.startsWith('certificates/')),
          );
    return { name, inLocker };
  });
}

export function sampleMatch(advert: JobAdvert, candidate: Candidate): MatchResult {
  const p = candidate.profile;
  const mine = words([p.experience, p.education, p.skills, p.highestLevel, p.occupation].join(' '));
  const matches: string[] = [];
  const gaps: MatchResult['gaps'] = [];
  for (const requirement of advert.requirements) {
    const need = [...words(requirement)];
    if (need.length && need.some((w) => mine.has(w))) matches.push(requirement);
    else gaps.push({ item: requirement, fix: 'If you have this, add it to My Details > Career so your CV shows it.' });
  }
  if (!p.experience && !p.education && !p.skills) {
    gaps.unshift({ item: 'Your career details are empty', fix: 'Fill in experience, education and skills in My Details.' });
  }
  const share = advert.requirements.length ? matches.length / advert.requirements.length : 0;
  const fit = share >= 0.7 ? 'strong' : share >= 0.4 ? 'fair' : 'weak';
  return {
    fit,
    summary: advert.requirements.length
      ? `You match about ${matches.length} of ${advert.requirements.length} requirements from what you saved. The AI check reads them more carefully.`
      : 'The advert lists no clear requirements, so read it through yourself.',
    matches,
    gaps,
    documents: documentsInLocker(advert, candidate.lockerFiles),
    checkedAt: new Date().toISOString(),
    mode: 'sample',
  };
}

export function cvAnswersFor(advert: JobAdvert, profile: Record<string, string>): CvAnswers {
  return {
    fullName: profile.fullName ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    location: profile.town || profile.county || '',
    targetJob: advert.title,
    experience: profile.experience ?? '',
    education: profile.education || [profile.highestLevel, profile.school, profile.kcseYear].filter(Boolean).join(', '),
    skills: profile.skills ?? '',
    company: advert.employer,
  };
}

export function emailDraft(advert: JobAdvert, name: string, phone = '') {
  return {
    subject: `Application for ${advert.title}${advert.employer ? ` – ${advert.employer}` : ''}`,
    body: `Dear Hiring Manager,\n\nPlease find attached my application for the ${advert.title} position${advert.employer ? ` at ${advert.employer}` : ''}. It includes my cover letter, CV and copies of my certificates.\n\nThank you for considering my application. I look forward to hearing from you.\n\nYours faithfully,\n${name}${phone ? `\n${phone}` : ''}`,
  };
}

export function sampleApplication(advert: JobAdvert, profile: Record<string, string>): TailoredApplication {
  return {
    cv: sampleCv(cvAnswersFor(advert, profile)),
    email: emailDraft(advert, profile.fullName ?? '', profile.phone ?? ''),
    writtenAt: new Date().toISOString(),
    mode: 'sample',
  };
}

export function sampleQuestions(advert: JobAdvert): InterviewQuestion[] {
  const role = advert.title || 'this role';
  return [
    { question: 'Tell us about yourself.', tip: 'Two minutes: your training, your last job, and why this role fits you.' },
    { question: `Why do you want to work as ${role}${advert.employer ? ` at ${advert.employer}` : ''}?`, tip: 'Mention something specific about the employer and what you can offer.' },
    ...advert.requirements.slice(0, 3).map((r) => ({
      question: `The advert asks for: “${r}”. Give an example of how you meet this.`,
      tip: 'Use a real example: the situation, what you did, and the result.',
    })),
    { question: 'Tell us about a time you solved a problem at work or school.', tip: 'Pick a short story with a clear result.' },
    { question: 'What are your salary expectations?', tip: 'Give a range based on the advert or similar jobs, and say you are open to discussion.' },
    { question: 'Do you have any questions for us?', tip: 'Ask about the team, training, or what success looks like in the first three months.' },
  ];
}
