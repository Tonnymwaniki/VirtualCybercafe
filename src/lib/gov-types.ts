// Shapes shared by the Government Services screens and the /api/gov route.

export type IdDetails = {
  fullName: string;
  idNumber: string;
  // YYYY-MM-DD
  dateOfBirth: string;
  sex: string;
  placeOfBirth: string;
  dateOfIssue: string;
};

export const emptyIdDetails: IdDetails = {
  fullName: '',
  idNumber: '',
  dateOfBirth: '',
  sex: '',
  placeOfBirth: '',
  dateOfIssue: '',
};

export type RequirementsCheck = {
  items: { label: string; note: string }[];
  fee: string;
  where: string;
  steps: string[];
  sources: { title: string; url: string }[];
  checkedAt: string;
  mode: 'ai' | 'sample';
};

export type IdReadResult = {
  details: Partial<IdDetails>;
  problems: string[];
  mode: 'ai' | 'sample';
};

export type TaskProgress = {
  // Index of the last stage done; -1 when not started.
  stage: number;
  stageDates: Record<number, string>;
  // Requirement ids the user ticked as ready.
  ready: string[];
  answers: Record<string, string>;
  updatedAt: string;
};

export const emptyProgress: TaskProgress = { stage: -1, stageDates: {}, ready: [], answers: {}, updatedAt: '' };
