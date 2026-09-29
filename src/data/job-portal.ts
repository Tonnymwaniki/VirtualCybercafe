// The job application form: the details most Kenyan job portals ask for
// (Public Service Commission, county boards, company careers sites). The
// form helper works on it like a government form, filling it from My Details.

import type { FormTask } from '@/data/gov-tasks';
import { jobStatuses } from '@/lib/jobs-types';

export const jobPortalTask: FormTask = {
  id: 'job_portal',
  title: 'Online job application',
  description: 'The details job portals ask for',
  icon: 'briefcase',
  agency: 'the employer’s job portal',
  portal: { label: 'Open application site', url: 'https://www.publicservice.go.ke' },
  officialDomains: ['publicservice.go.ke', 'psckjobs.go.ke'],
  requirements: [
    { id: 'cv', label: 'CV for this job', lockerCategory: 'Documents' },
    { id: 'letter', label: 'Cover letter for this job', lockerCategory: 'Documents' },
    { id: 'id_copy', label: 'Copy of National ID', lockerName: 'national-id', lockerCategory: 'Documents' },
    { id: 'certificates', label: 'Academic and professional certificates', lockerCategory: 'Certificates' },
  ],
  steps: [
    'Create an account on the employer’s job portal with your email and phone.',
    'Fill in your personal details, education and work history.',
    'Upload your CV, cover letter and certificates.',
    'Check everything, then submit before the deadline and keep the confirmation.',
  ],
  fields: [
    { key: 'fullName', label: 'Full name (as on ID)' },
    { key: 'idNumber', label: 'ID number', kind: 'idNumber' },
    { key: 'dateOfBirth', label: 'Date of birth', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { key: 'sex', label: 'Sex' },
    { key: 'phone', label: 'Phone number', kind: 'phone', placeholder: '07XX XXX XXX' },
    { key: 'email', label: 'Email address', kind: 'email', placeholder: 'you@example.com' },
    { key: 'county', label: 'Home county', optional: true },
    { key: 'postalAddress', label: 'Postal address and code', optional: true },
    { key: 'kraPin', label: 'KRA PIN', kind: 'kraPin', optional: true },
    { key: 'highestLevel', label: 'Highest level of education', optional: true },
    { key: 'kcseIndex', label: 'KCSE index number', optional: true },
    { key: 'kcseYear', label: 'KCSE year', optional: true },
  ],
  payment: { free: true, howTo: ['Applying for a job is free. Never pay anyone to apply.'] },
  stages: [...jobStatuses],
};
