// "My Details": what a person fills in once and every form reuses. Form
// fields with the same key as a profile field are filled from, and saved
// back to, the profile.

export type FieldKind = 'text' | 'email' | 'phone' | 'date' | 'idNumber' | 'kraPin';

export type ProfileSection = 'Identity' | 'Contacts' | 'Tax and work' | 'Family' | 'Education';

export type ProfileField = {
  key: string;
  label: string;
  section: ProfileSection;
  kind?: FieldKind;
  placeholder?: string;
};

export type Profile = Record<string, string>;

export const profileSections: ProfileSection[] = ['Identity', 'Contacts', 'Tax and work', 'Family', 'Education'];

export const profileFields: ProfileField[] = [
  { key: 'fullName', label: 'Full name (as on ID)', section: 'Identity' },
  { key: 'idNumber', label: 'ID number', section: 'Identity', kind: 'idNumber' },
  { key: 'dateOfBirth', label: 'Date of birth', section: 'Identity', kind: 'date', placeholder: 'YYYY-MM-DD' },
  { key: 'sex', label: 'Sex', section: 'Identity' },
  { key: 'placeOfBirth', label: 'Place of birth (district)', section: 'Identity' },
  { key: 'dateOfIssue', label: 'ID date of issue', section: 'Identity', kind: 'date', placeholder: 'YYYY-MM-DD' },

  { key: 'phone', label: 'Phone number', section: 'Contacts', kind: 'phone', placeholder: '07XX XXX XXX' },
  { key: 'email', label: 'Email address', section: 'Contacts', kind: 'email', placeholder: 'you@example.com' },
  { key: 'county', label: 'County', section: 'Contacts' },
  { key: 'town', label: 'Town', section: 'Contacts' },
  { key: 'postalAddress', label: 'Postal address and code', section: 'Contacts', placeholder: 'P.O. Box 123-00100' },

  { key: 'kraPin', label: 'KRA PIN', section: 'Tax and work', kind: 'kraPin', placeholder: 'A123456789B' },
  { key: 'occupation', label: 'Occupation', section: 'Tax and work' },
  { key: 'employer', label: 'Employer', section: 'Tax and work' },
  { key: 'incomeSource', label: 'Main income source', section: 'Tax and work', placeholder: 'Employment, business, none...' },

  { key: 'fatherName', label: 'Father’s full name', section: 'Family' },
  { key: 'fatherId', label: 'Father’s ID number', section: 'Family', kind: 'idNumber' },
  { key: 'motherName', label: 'Mother’s full name', section: 'Family' },
  { key: 'motherId', label: 'Mother’s ID number', section: 'Family', kind: 'idNumber' },
  { key: 'nextOfKinName', label: 'Next of kin name', section: 'Family' },
  { key: 'nextOfKinPhone', label: 'Next of kin phone', section: 'Family', kind: 'phone' },

  { key: 'highestLevel', label: 'Highest level of education', section: 'Education', placeholder: 'KCSE, Certificate, Diploma, Degree...' },
  { key: 'school', label: 'Secondary school', section: 'Education' },
  { key: 'kcseIndex', label: 'KCSE index number', section: 'Education' },
  { key: 'kcseYear', label: 'KCSE year', section: 'Education' },
];

const profileKeys = new Set(profileFields.map((field) => field.key));

export function isProfileKey(key: string) {
  return profileKeys.has(key);
}

// Keeps only known, non-empty profile values.
export function cleanProfile(values: Record<string, unknown>): Profile {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key, value]) => profileKeys.has(key) && typeof value === 'string' && value.trim())
      .map(([key, value]) => [key, String(value).trim().slice(0, 200)]),
  );
}
