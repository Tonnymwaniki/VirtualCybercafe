// Shapes shared by the Government Services screens and the /api/gov route.

// What the ID reader returns; the keys match My Details (profile-fields.ts).
export type IdDetails = {
  fullName: string;
  idNumber: string;
  // YYYY-MM-DD
  dateOfBirth: string;
  sex: string;
  placeOfBirth: string;
  dateOfIssue: string;
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

// The form helper (/api/form-helper): fills fields, fixes errors, and asks
// the screen to take actions.
export type HelperMessage = { role: 'user' | 'assistant'; text: string };

export type FieldUpdate = { key: string; value: string; reason: string };

export type HelperAction =
  | { type: 'open'; label: string; route: string }
  | { type: 'ready'; requirementId: string }
  | { type: 'stage'; stage: number };

export type HelperRequest = {
  taskId: string;
  values: Record<string, string>;
  profile: Record<string, string>;
  lockerFiles: string[];
  issues: { key: string; message: string }[];
  messages: HelperMessage[];
  // A screenshot of an error, as base64 JPEG, sent with the last message.
  image?: string;
};

export type HelperResponse = {
  reply: string;
  updates: FieldUpdate[];
  actions: HelperAction[];
  mode: 'ai' | 'sample';
};
