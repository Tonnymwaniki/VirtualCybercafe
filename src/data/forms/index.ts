// Every form Form Intelligence supports. Version one: the job application.

import { jobApplicationForm } from '@/data/forms/job-application';
import type { FormSchema } from '@/lib/forms/schema';

export const forms: FormSchema[] = [jobApplicationForm];

export function findForm(id: string) {
  return forms.find((form) => form.id === id);
}
