import { jobApplicationForm as form } from '@/data/forms/job-application';
import { reasonAbout } from '@/lib/forms/reason';
import type { FormEntry } from '@/lib/forms/schema';
import { documentProblems, sniffType } from '@/lib/forms/documents';
import { fromProfile } from '@/lib/forms/store';

const now = new Date('2026-09-30T10:00:00Z');
const file = (name: string, bytes = 100_000) => ({ path: `u/${name}`, name, mimeType: 'application/pdf', bytes });
const complete: FormEntry = {
  id: 'e1',
  formId: form.id,
  title: 'Clerk',
  answers: {
    fullName: 'Jane Wanjiru Mwangi',
    idNumber: '12345678',
    dateOfBirth: '1998-04-21',
    sex: 'Female',
    county: 'Nairobi',
    nationality: 'Kenyan',
    advertOpenTo: 'open',
    convicted: 'no',
    dismissed: 'no',
    phone: '0712345678',
    email: 'jane@example.com',
    kraPin: 'A123456789B',
    highestLevel: 'Degree',
    education: '2016-2020 BCom, Maseno University, Second Class Upper',
    meetsRequirements: 'yes',
    referees: 'John Otieno, lecturer, 0722000000; Mary Njeri, manager, 0733000000',
    declaration: 'yes',
  },
  sourceOf: {},
  files: { cvFile: file('cv.pdf'), letterFile: file('letter.pdf'), idFile: file('id.pdf'), certificatesFile: file('certs.pdf') },
  createdAt: '',
  updatedAt: '',
};

describe('form reasoning', () => {
  it('is ready only when every required field and document passes', () => {
    const result = reasonAbout(form, complete, now);
    expect(result.ready).toBe(true);
    expect(result.percent).toBe(100);
    expect(result.next).toBeUndefined();
  });

  it('never says 100% while something is missing, and names the next thing', () => {
    const { idFile: _, ...files } = complete.files;
    const result = reasonAbout(form, { ...complete, files, answers: { ...complete.answers, phone: '12345' } }, now);
    expect(result.ready).toBe(false);
    expect(result.percent).toBeLessThan(100);
    expect(result.next?.fieldId).toBe('phone');
    expect(result.fields.phone.message).toMatch(/Kenyan number/);
    expect(result.fields.idFile.status).toBe('missing');
    expect(result.sections.find((s) => s.id === 'documents')?.missing).toBe(1);
  });

  it('explains a wrong file plainly', () => {
    const result = reasonAbout(form, { ...complete, files: { ...complete.files, cvFile: { ...file('cv.png'), name: 'cv.png' } } }, now);
    expect(result.fields.cvFile.message).toBe('CV is the wrong type of file. Required: PDF, DOCX or DOC. Yours: PNG.');
  });

  it('warns about knockout answers and closed deadlines without blocking', () => {
    const result = reasonAbout(form, { ...complete, deadline: '2026-09-20', answers: { ...complete.answers, meetsRequirements: 'no' } }, now);
    expect(result.ready).toBe(true);
    expect(result.risks.map((r) => r.message).join(' ')).toMatch(/deadline has passed[\s\S]*minimum requirement/);
  });

  it('asks serving-officer adverts who is applying, and warns outsiders', () => {
    const result = reasonAbout(form, { ...complete, answers: { ...complete.answers, advertOpenTo: 'serving' } }, now);
    expect(result.next?.fieldId).toBe('servingOfficer');
    const outsider = reasonAbout(form, { ...complete, answers: { ...complete.answers, advertOpenTo: 'serving', servingOfficer: 'no' } }, now);
    expect(outsider.risks.map((r) => r.message).join(' ')).toMatch(/serving officers only/);
  });

  it('checks age and name rules', () => {
    const result = reasonAbout(form, { ...complete, answers: { ...complete.answers, dateOfBirth: '2012-01-01', fullName: 'Jane' } }, now);
    expect(result.fields.fullName.status).toBe('invalid');
    expect(result.fields.dateOfBirth.message).toMatch(/at least 18/);
  });

  it('fills empty fields from My Details only', () => {
    expect(fromProfile(form, { answers: { phone: '0700000000' } }, { phone: '0711111111', fullName: 'Jane Mwangi' })).toEqual({ fullName: 'Jane Mwangi' });
  });
});

describe('form documents', () => {
  const field = form.sections.flatMap((s) => s.fields).find((f) => f.id === 'kraTccFile')!;
  it('reads the real type from the bytes, not the name', () => {
    expect(sniffType(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'x.jpg')).toBe('pdf');
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'scan.pdf')).toBe('jpg');
    expect(sniffType(new Uint8Array([0x50, 0x4b, 3, 4]), 'cv.docx')).toBe('docx');
  });

  it('says what is wrong, what is required and what yours is, and whether it can be fixed', () => {
    const photo = { path: 'p', name: 'tcc.pdf', mimeType: 'image/jpeg', bytes: 4_800_000, facts: { type: 'jpg' as const, bytes: 4_800_000 } };
    const problems = documentProblems(field, photo, 2048);
    expect(problems).toEqual([
      { what: 'KRA tax compliance certificate is the wrong type of file.', required: 'PDF', yours: 'JPG', fixable: true },
      { what: 'KRA tax compliance certificate is too large.', required: 'Up to 2.0 MB', yours: '4.6 MB', fixable: true },
    ]);
    const locked = documentProblems(field, { ...photo, facts: { type: 'pdf', bytes: 1000, locked: true } });
    expect(locked[0]).toMatchObject({ yours: 'Locked PDF', fixable: false });
  });
});
