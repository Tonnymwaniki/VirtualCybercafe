// CV and cover letter: the questions we ask, the document shape, a
// template-based writer used until the AI key is set, and the PDF HTML.

export type CvAnswers = {
  fullName: string;
  phone: string;
  email: string;
  location: string;
  targetJob: string;
  experience: string;
  education: string;
  skills: string;
  company: string;
};

export type CvQuestion = {
  key: keyof CvAnswers;
  question: string;
  placeholder: string;
  optional?: boolean;
  multiline?: boolean;
};

export const cvQuestions: CvQuestion[] = [
  { key: 'fullName', question: 'What is your full name?', placeholder: 'e.g. Jane Wanjiku' },
  { key: 'phone', question: 'What phone number should employers call?', placeholder: 'e.g. 0712 345 678' },
  { key: 'email', question: 'And your email address?', placeholder: 'e.g. jane@email.com' },
  { key: 'location', question: 'Which town or county do you live in?', placeholder: 'e.g. Nairobi' },
  {
    key: 'targetJob',
    question: 'What job are you applying for?',
    placeholder: 'e.g. Customer Service Assistant',
  },
  {
    key: 'experience',
    question:
      'Tell me about your work experience. For each job: title, employer, years, and what you did. One job per line.',
    placeholder: 'e.g. Cashier, Naivas Supermarket, 2021–2024, served customers and balanced the till',
    multiline: true,
  },
  {
    key: 'education',
    question: 'What is your education? School or college, course, and year. One per line.',
    placeholder: 'e.g. Diploma in Business Management, KCA University, 2020',
    multiline: true,
  },
  {
    key: 'skills',
    question: 'List your main skills, separated by commas.',
    placeholder: 'e.g. Customer service, MS Excel, M-Pesa, Swahili, English',
  },
  {
    key: 'company',
    question: 'Which company are you applying to? This goes in the cover letter. Skip if you don’t know yet.',
    placeholder: 'e.g. Safaricom PLC',
    optional: true,
  },
];

export type CvJob = { title: string; organisation: string; period: string; bullets: string[] };
export type CvEducation = { qualification: string; institution: string; year: string };

export type CvDocument = {
  headline: string;
  summary: string;
  experience: CvJob[];
  education: CvEducation[];
  skills: string[];
  coverLetter: string;
};

export type CvResponse = { cv: CvDocument; mode: 'ai' | 'sample' };

// JSON schema the AI must follow; mirrors CvDocument.
export const cvDocumentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'summary', 'experience', 'education', 'skills', 'coverLetter'],
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'organisation', 'period', 'bullets'],
        properties: {
          title: { type: 'string' },
          organisation: { type: 'string' },
          period: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['qualification', 'institution', 'year'],
        properties: {
          qualification: { type: 'string' },
          institution: { type: 'string' },
          year: { type: 'string' },
        },
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
    coverLetter: { type: 'string' },
  },
} as const;

function lines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parts(line: string) {
  return line.split(',').map((part) => part.trim()).filter(Boolean);
}

function sentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const capital = trimmed[0].toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

// Template-based CV used until the AI key is configured.
export function sampleCv(answers: CvAnswers): CvDocument {
  const experience = lines(answers.experience).map((line) => {
    const [title = line, organisation = '', period = '', ...rest] = parts(line);
    const duties = rest.join(', ');
    return {
      title,
      organisation,
      period,
      bullets: duties ? duties.split(/\band\b|;/).map(sentence).filter(Boolean) : [],
    };
  });
  const education = lines(answers.education).map((line) => {
    const [qualification = line, institution = '', year = ''] = parts(line);
    return { qualification, institution, year };
  });
  const skills = parts(answers.skills);
  const latest = experience[0];
  const company = answers.company.trim() || 'your organisation';
  const role = answers.targetJob.trim();

  const summary =
    `Reliable and hardworking ${role ? `candidate for the ${role} role` : 'professional'} based in ${answers.location.trim()}` +
    (latest ? `, with experience as a ${latest.title}${latest.organisation ? ` at ${latest.organisation}` : ''}` : '') +
    (skills.length ? `. Skilled in ${skills.slice(0, 4).join(', ')}.` : '.');

  const experienceLine = latest
    ? `, with experience as a ${latest.title}${latest.organisation ? ` at ${latest.organisation}` : ''}`
    : '';
  const duties = latest?.bullets.map((b) => b.replace(/\.$/, '').toLowerCase()) ?? [];
  const dutiesText =
    duties.length > 1 ? `${duties.slice(0, -1).join(', ')} and ${duties[duties.length - 1]}` : duties[0];

  const coverLetter = [
    'Dear Hiring Manager,',
    `I am writing to apply for the ${role} position at ${company}. I am a reliable and hardworking person based in ${answers.location.trim()}${experienceLine}.` +
      (skills.length ? ` My skills include ${skills.slice(0, 4).join(', ')}.` : ''),
    latest
      ? `As a ${latest.title}${latest.organisation ? ` at ${latest.organisation}` : ''}, I ${dutiesText ?? 'built strong work habits and served customers well'}. I am confident this experience prepares me to contribute from day one.`
      : 'I am eager to learn quickly and contribute from day one.',
    `I would welcome the chance to discuss how I can support ${company}. I can be reached on ${answers.phone.trim()} or ${answers.email.trim()}.`,
    `Yours faithfully,\n${answers.fullName.trim()}`,
  ].join('\n\n');

  return { headline: role, summary, experience, education, skills, coverLetter };
}

function escape(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const baseStyle = `
  @page { size: A4; margin: 18mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #0F172A; font-size: 11pt; line-height: 1.45; }
  h1 { font-size: 22pt; margin: 0; color: #0B1E5B; }
  h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; color: #1E5EFF; border-bottom: 1px solid #E3E8F4; padding-bottom: 4px; margin: 18px 0 8px; }
  .headline { font-size: 13pt; color: #334155; margin-top: 2px; }
  .contact { color: #64748B; margin-top: 6px; }
  .item { margin-bottom: 10px; }
  .item-title { font-weight: bold; }
  .muted { color: #64748B; }
  ul { margin: 4px 0 0 18px; padding: 0; }
  .skills { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill { background: #E8EFFF; border-radius: 10px; padding: 2px 10px; }
  p { margin: 0 0 12px; white-space: pre-line; }
`;

export function cvHtml(cv: CvDocument, answers: CvAnswers) {
  const contact = [answers.phone, answers.email, answers.location].map((c) => c.trim()).filter(Boolean);
  const experience = cv.experience
    .map(
      (job) => `<div class="item"><div class="item-title">${escape(job.title)}</div>
<div class="muted">${escape([job.organisation, job.period].filter(Boolean).join(' · '))}</div>
${job.bullets.length ? `<ul>${job.bullets.map((b) => `<li>${escape(b)}</li>`).join('')}</ul>` : ''}</div>`,
    )
    .join('');
  const education = cv.education
    .map(
      (e) => `<div class="item"><div class="item-title">${escape(e.qualification)}</div>
<div class="muted">${escape([e.institution, e.year].filter(Boolean).join(' · '))}</div></div>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8" /><style>${baseStyle}</style></head><body>
<h1>${escape(answers.fullName.trim())}</h1>
${cv.headline ? `<div class="headline">${escape(cv.headline)}</div>` : ''}
<div class="contact">${contact.map(escape).join(' · ')}</div>
<h2>Profile</h2><p>${escape(cv.summary)}</p>
${experience ? `<h2>Experience</h2>${experience}` : ''}
${education ? `<h2>Education</h2>${education}` : ''}
${cv.skills.length ? `<h2>Skills</h2><div class="skills">${cv.skills.map((s) => `<span class="skill">${escape(s)}</span>`).join('')}</div>` : ''}
<h2>Referees</h2><p>Available on request.</p>
</body></html>`;
}

export function letterHtml(cv: CvDocument, answers: CvAnswers) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const contact = [answers.phone, answers.email, answers.location].map((c) => c.trim()).filter(Boolean);
  return `<!doctype html><html><head><meta charset="utf-8" /><style>${baseStyle}</style></head><body>
<div><strong>${escape(answers.fullName.trim())}</strong></div>
<div class="muted">${contact.map(escape).join('<br />')}</div>
<p style="margin-top:18px">${escape(date)}</p>
${cv.coverLetter.split(/\n\s*\n/).map((para) => `<p>${escape(para)}</p>`).join('')}
</body></html>`;
}
