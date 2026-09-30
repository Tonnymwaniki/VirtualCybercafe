// Form Intelligence: every supported form is data, not a screen. A schema
// says what the real form's backend expects (fields, rules, files, knockout
// questions, common reasons for rejection) with the official source, and one
// screen (src/app/forms/[id].tsx) draws any schema. The reasoning in
// reason.ts runs these rules on the phone, for free.

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'phone'
  | 'email'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'image'
  | 'textarea';

// Checks a value must pass. `message` is what the person reads when it fails.
export type Rule =
  | { kind: 'pattern'; pattern: string; message: string }
  | { kind: 'minLength'; value: number; message: string }
  | { kind: 'maxLength'; value: number; message: string }
  | { kind: 'min'; value: number; message: string }
  | { kind: 'max'; value: number; message: string }
  | { kind: 'idNumber' }
  | { kind: 'kraPin' }
  | { kind: 'kenyanPhone' }
  | { kind: 'email' }
  | { kind: 'pastDate' }
  | { kind: 'minAge'; value: number }
  | { kind: 'maxAge'; value: number }
  | { kind: 'fullName' }
  | { kind: 'words'; min: number; message: string };

// Where a value can come from, best first.
export type Source = 'profile' | 'id_card' | 'cv' | 'job';

export type DocType = 'pdf' | 'jpg' | 'png' | 'doc' | 'docx' | 'other';

// A file the form needs. `presetId` links to an upload rule in
// src/data/presets.ts when an official one exists.
export type DocumentRule = {
  types: Exclude<DocType, 'other'>[];
  maxKB?: number;
  maxPages?: number;
  presetId?: string;
  lockerCategory?: string;
};

export type Option = { value: string; label: string };

export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  // Why the real form asks for it, in plain words.
  why?: string;
  // How to answer it.
  help?: string;
  placeholder?: string;
  options?: Option[];
  rules?: Rule[];
  sources?: Source[];
  // The My Details field it fills from and saves to.
  profileKey?: string;
  document?: DocumentRule;
  // A screening question: any other answer means the employer will likely
  // reject the application.
  knockout?: { expect: string; message: string };
  // Shown only when another field has this value.
  showIf?: { field: string; equals: string };
};

export type FormSection = {
  id: string;
  title: string;
  why?: string;
  fields: FormField[];
};

// A check across fields (the name matches the ID, dates in order).
export type CrossCheck =
  | { kind: 'dateOrder'; before: string; after: string; message: string }
  | { kind: 'differs'; a: string; b: string; message: string }
  | { kind: 'deadline'; message: string };

export type SourceLink = { label: string; url: string; checked: string };

export type FormSchema = {
  id: string;
  version: number;
  title: string;
  description: string;
  icon: string;
  // Where the real form lives and where its rules come from.
  officialSite?: SourceLink;
  sources: SourceLink[];
  sections: FormSection[];
  crossChecks?: CrossCheck[];
  // Why real applications of this kind get turned down, for the tips.
  rejectionReasons?: { reason: string; avoid: string }[];
};

// What was measured on the real file when it was attached.
export type FileFacts = {
  type: DocType;
  bytes: number;
  width?: number;
  height?: number;
  pages?: number;
  locked?: boolean;
  unreadable?: boolean;
};

export type FormFile = {
  path: string;
  name: string;
  mimeType: string;
  bytes: number;
  facts?: FileFacts;
  // Set after Fix automatically: what it was before.
  fixedFrom?: { name: string; bytes: number; type?: DocType };
  notes?: string[];
};

// One application being prepared.
export type FormEntry = {
  id: string;
  formId: string;
  // What it is for, e.g. "Accountant at KCB".
  title: string;
  jobId?: string;
  deadline?: string;
  answers: Record<string, string>;
  // Where each answer came from (profile, id_card, cv, job or typed).
  sourceOf: Record<string, Source | 'typed'>;
  files: Record<string, FormFile>;
  // Size limits the portal states for this application, per document field (KB).
  limits?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
};

export function allFields(schema: FormSchema) {
  return schema.sections.flatMap((section) => section.fields);
}

export function isVisible(field: FormField, answers: Record<string, string>) {
  return !field.showIf || (answers[field.showIf.field] ?? '') === field.showIf.equals;
}

export const isFileField = (field: FormField) => field.type === 'file' || field.type === 'image';
