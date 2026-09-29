// The Government Services workspace: one guided flow per task. Fees and
// requirements change, so the "What you need" step checks the official sites
// live; the lists here are the starting point and the offline fallback.

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { LockerCategory } from '@/data/locker';
import type { FieldKind } from '@/data/profile-fields';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type GovTaskId =
  | 'good_conduct'
  | 'kra_pin'
  | 'passport'
  | 'lost_id'
  | 'driving_licence'
  | 'birth_certificate'
  | 'sha'
  | 'business_name'
  | 'kra_returns';

export type Requirement = {
  id: string;
  label: string;
  // Documents can be kept in the Locker; the file name starts with lockerName.
  lockerName?: string;
  lockerCategory?: LockerCategory;
  // An app tool that helps prepare this document.
  fix?: { label: string; route: string };
};

// A field whose key matches a My Details field (profile-fields.ts) is filled
// from the profile and saved back to it.
export type FormField = {
  key: string;
  label: string;
  placeholder?: string;
  optional?: boolean;
  kind?: FieldKind;
};

export type GovTask = {
  id: GovTaskId;
  title: string;
  description: string;
  icon: IconName;
  agency: string;
  portal: { label: string; url: string };
  // Web search for this task is limited to these sites.
  officialDomains: string[];
  requirements: Requirement[];
  steps: string[];
  fields: FormField[];
  payment: { free?: boolean; howTo: string[] };
  // Progress stages the user ticks off in the Track step.
  stages: string[];
};

const idScan: Requirement = {
  id: 'id_scan',
  label: 'National ID, front and back (scan or clear photo)',
  lockerName: 'national-id',
  lockerCategory: 'Documents',
  fix: { label: 'Turn photos into a PDF', route: '/studio/photos-to-pdf' },
};

const idFields: FormField[] = [
  { key: 'fullName', label: 'Full name (as on ID)' },
  { key: 'idNumber', label: 'ID number', kind: 'idNumber' },
  { key: 'dateOfBirth', label: 'Date of birth', kind: 'date', placeholder: 'YYYY-MM-DD' },
  { key: 'sex', label: 'Sex' },
];

const contactFields: FormField[] = [
  { key: 'phone', label: 'Phone number', kind: 'phone', placeholder: '07XX XXX XXX' },
  { key: 'email', label: 'Email address', kind: 'email', placeholder: 'you@example.com' },
];

const eCitizenPayment = [
  'At the eCitizen checkout, choose M-Pesa.',
  'Either enter your phone number and wait for the M-Pesa prompt, or use Lipa na M-Pesa > Paybill with the business number and account (bill reference) shown on your eCitizen invoice.',
  'Type your M-Pesa PIN only on your own phone’s M-Pesa prompt. Never share it with anyone, including this app.',
  'Keep the M-Pesa message and download the receipt from eCitizen.',
];

export const govTasks: GovTask[] = [
  {
    id: 'good_conduct',
    title: 'Certificate of Good Conduct',
    description: 'Police clearance from the DCI',
    icon: 'shield-checkmark',
    agency: 'Directorate of Criminal Investigations (DCI) on eCitizen',
    portal: { label: 'Open eCitizen (DCI)', url: 'https://accounts.ecitizen.go.ke' },
    officialDomains: ['ecitizen.go.ke', 'dci.go.ke', 'hudumakenya.go.ke'],
    requirements: [
      idScan,
      { id: 'ecitizen_account', label: 'An eCitizen account you can sign in to' },
      { id: 'fee', label: 'Fee for the certificate (paid on eCitizen)' },
      { id: 'fingerprints', label: 'Visit a DCI office or Huduma Centre for fingerprints (C24 form)' },
    ],
    steps: [
      'Sign in to eCitizen and open the DCI service: Police Clearance Certificate.',
      'Fill in your details and pay the fee.',
      'Print the invoice and the C24 fingerprint form.',
      'Take fingerprints at a DCI office or Huduma Centre with your original ID.',
      'Download the certificate from eCitizen when it is ready.',
    ],
    fields: [
      ...idFields,
      { key: 'placeOfBirth', label: 'Place of birth (district)' },
      ...contactFields,
      { key: 'county', label: 'County where you live' },
    ],
    payment: { howTo: eCitizenPayment },
    stages: ['Applied on eCitizen', 'Paid', 'Fingerprints taken', 'Certificate ready', 'Downloaded and saved'],
  },
  {
    id: 'kra_pin',
    title: 'KRA PIN',
    description: 'Register for a PIN on iTax',
    icon: 'card',
    agency: 'Kenya Revenue Authority (iTax)',
    portal: { label: 'Open iTax', url: 'https://itax.kra.go.ke' },
    officialDomains: ['kra.go.ke'],
    requirements: [
      { id: 'id_number', label: 'Your National ID number' },
      { id: 'email', label: 'An email address you can open (the PIN is sent there)' },
      { id: 'phone', label: 'Your phone number' },
      { id: 'address', label: 'Your physical and postal address' },
    ],
    steps: [
      'Open iTax and choose New PIN Registration.',
      'Choose Individual, then Online form.',
      'Enter your ID details, contacts, address and income source.',
      'Submit. The PIN certificate is sent to your email.',
      'Save the PIN certificate to your Locker.',
    ],
    fields: [
      ...idFields,
      ...contactFields,
      { key: 'county', label: 'County' },
      { key: 'town', label: 'Town' },
      { key: 'postalAddress', label: 'Postal address and code', optional: true, placeholder: 'P.O. Box 123-00100' },
      { key: 'incomeSource', label: 'Main income source', placeholder: 'Employment, business, none...' },
      { key: 'employerPin', label: 'Employer’s KRA PIN (if employed)', optional: true, kind: 'kraPin' },
    ],
    payment: {
      free: true,
      howTo: ['Registering for a KRA PIN is free. If anyone asks you to pay for it, don’t.'],
    },
    stages: ['Form submitted on iTax', 'PIN received by email', 'PIN certificate saved to Locker'],
  },
  {
    id: 'passport',
    title: 'Passport',
    description: 'Apply for or renew a Kenyan passport',
    icon: 'airplane',
    agency: 'Department of Immigration Services on eCitizen',
    portal: { label: 'Open eCitizen (Immigration)', url: 'https://accounts.ecitizen.go.ke' },
    officialDomains: ['ecitizen.go.ke', 'immigration.go.ke'],
    requirements: [
      idScan,
      {
        id: 'birth_certificate',
        label: 'Birth certificate (scan)',
        lockerName: 'birth-certificate',
        lockerCategory: 'Certificates',
        fix: { label: 'Turn photos into a PDF', route: '/studio/photos-to-pdf' },
      },
      {
        id: 'passport_photo',
        label: 'Passport photo (white background, 600×600, under 200 KB)',
        lockerName: 'passport-photo',
        lockerCategory: 'Photos',
        fix: { label: 'Make passport photo', route: '/studio/passport' },
      },
      {
        id: 'recommender_id',
        label: 'Recommender’s ID copy and details',
        lockerName: 'recommender-id',
        lockerCategory: 'Documents',
      },
      { id: 'parents_ids', label: 'Parents’ ID numbers (or death certificates)', lockerName: 'parents-ids', lockerCategory: 'Documents' },
      { id: 'old_passport', label: 'Old passport (only if renewing)' },
    ],
    steps: [
      'Sign in to eCitizen and open Department of Immigration Services.',
      'Choose Passport, then the type (34, 50 or 66 pages).',
      'Fill in your details, your parents’ and your recommender’s, and upload the documents and photo.',
      'Pay the fee and download the application form.',
      'Book an appointment and take the form and originals for biometrics.',
      'Collect the passport when you get the message that it is ready.',
    ],
    fields: [
      ...idFields,
      { key: 'placeOfBirth', label: 'Place of birth' },
      ...contactFields,
      { key: 'passportType', label: 'Passport type', placeholder: '34, 50 or 66 pages' },
      { key: 'certFatherName', label: 'Father’s full name' },
      { key: 'certFatherId', label: 'Father’s ID number', kind: 'idNumber', optional: true },
      { key: 'certMotherName', label: 'Mother’s full name' },
      { key: 'certMotherId', label: 'Mother’s ID number', kind: 'idNumber', optional: true },
      { key: 'recommenderName', label: 'Recommender’s full name' },
      { key: 'recommenderId', label: 'Recommender’s ID number', kind: 'idNumber' },
      { key: 'recommenderPhone', label: 'Recommender’s phone', kind: 'phone' },
      { key: 'recommenderJob', label: 'Recommender’s occupation' },
    ],
    payment: { howTo: eCitizenPayment },
    stages: ['Applied on eCitizen', 'Paid', 'Appointment booked', 'Biometrics done', 'Passport ready', 'Collected'],
  },
  {
    id: 'lost_id',
    title: 'Replace a lost ID',
    description: 'Get a new National ID after losing it',
    icon: 'id-card',
    agency: 'National Registration Bureau (Registration of Persons)',
    portal: { label: 'Open eCitizen', url: 'https://accounts.ecitizen.go.ke' },
    officialDomains: ['ecitizen.go.ke', 'immigration.go.ke', 'nrb.go.ke', 'hudumakenya.go.ke', 'kenyalaw.org'],
    requirements: [
      {
        id: 'police_abstract',
        label: 'Police abstract for the lost ID (from any police station)',
        lockerName: 'police-abstract',
        lockerCategory: 'Documents',
      },
      {
        id: 'id_copy',
        label: 'Copy of the lost ID or its number, if you have one',
        lockerName: 'national-id',
        lockerCategory: 'Documents',
      },
      { id: 'birth_certificate', label: 'Birth certificate (if asked)', lockerName: 'birth-certificate', lockerCategory: 'Certificates' },
      { id: 'fee', label: 'Replacement fee' },
      { id: 'visit', label: 'Visit the registration office or Huduma Centre for photo and fingerprints' },
    ],
    steps: [
      'Report the loss at a police station and get a police abstract (OB number).',
      'Apply for replacement at the registration office or Huduma Centre (or on eCitizen where offered).',
      'Pay the replacement fee and keep the receipt.',
      'Have your photo and fingerprints taken and keep the waiting card.',
      'Collect the new ID when you get the message that it is ready.',
    ],
    fields: [
      ...idFields,
      ...contactFields,
      { key: 'obNumber', label: 'Police OB / abstract number' },
      { key: 'dateLost', label: 'Date the ID was lost', kind: 'date', placeholder: 'YYYY-MM-DD' },
      { key: 'placeLost', label: 'Where it was lost' },
      { key: 'county', label: 'County where you live' },
    ],
    payment: {
      howTo: [
        'Pay the replacement fee as shown on eCitizen or at the registration office.',
        'If paying by M-Pesa, use only the Paybill and account shown on your official invoice.',
        'Type your M-Pesa PIN only on your own phone. Never share it.',
        'Keep the receipt; you will be asked for it.',
      ],
    },
    stages: ['Police abstract obtained', 'Applied for replacement', 'Paid', 'Photo and fingerprints taken', 'New ID ready', 'Collected'],
  },
  {
    id: 'driving_licence',
    title: 'Driving licence (NTSA)',
    description: 'Renew or apply for a smart driving licence',
    icon: 'car',
    agency: 'National Transport and Safety Authority (NTSA) on eCitizen',
    portal: { label: 'Open eCitizen (NTSA)', url: 'https://accounts.ecitizen.go.ke' },
    officialDomains: ['ntsa.go.ke', 'ecitizen.go.ke'],
    requirements: [
      idScan,
      {
        id: 'current_licence',
        label: 'Current driving licence, or your driving school certificate and test results for a first licence',
        lockerName: 'driving-licence',
        lockerCategory: 'Documents',
      },
      {
        id: 'passport_photo',
        label: 'Passport photo (for a new smart licence)',
        lockerName: 'passport-photo',
        lockerCategory: 'Photos',
        fix: { label: 'Make passport photo', route: '/studio/passport' },
      },
      { id: 'ecitizen_account', label: 'An eCitizen account you can sign in to' },
      { id: 'fee', label: 'Licence fee (paid on eCitizen)' },
    ],
    steps: [
      'Sign in to eCitizen and open the NTSA service.',
      'Choose Driving Licence, then renewal, smart licence application, or first licence.',
      'Check your details, choose the licence period if renewing, and upload what is asked.',
      'Pay the fee and download the receipt or interim licence.',
      'For a smart licence, collect it from the NTSA or Huduma office you picked when you get the message.',
    ],
    fields: [
      ...idFields,
      ...contactFields,
      { key: 'licenceNumber', label: 'Current licence number', optional: true },
      { key: 'licenceClasses', label: 'Licence classes', placeholder: 'e.g. B, C1' },
      { key: 'renewalPeriod', label: 'Renewal period', optional: true, placeholder: '1 or 3 years' },
      { key: 'collectionCentre', label: 'Where you will collect it', optional: true, placeholder: 'e.g. Huduma Centre GPO' },
    ],
    payment: { howTo: eCitizenPayment },
    stages: ['Applied on eCitizen', 'Paid', 'Receipt or interim licence downloaded', 'Licence ready', 'Collected'],
  },
  {
    id: 'birth_certificate',
    title: 'Birth certificate',
    description: 'Apply for a birth certificate or a copy',
    icon: 'document-text',
    agency: 'Civil Registration Services on eCitizen',
    portal: { label: 'Open eCitizen (Civil Registration)', url: 'https://accounts.ecitizen.go.ke' },
    officialDomains: ['ecitizen.go.ke', 'crs.go.ke', 'immigration.go.ke', 'hudumakenya.go.ke'],
    requirements: [
      {
        id: 'birth_notification',
        label: 'Birth notification from the hospital, or a letter from the chief for a home birth',
        lockerName: 'birth-notification',
        lockerCategory: 'Documents',
        fix: { label: 'Turn photos into a PDF', route: '/studio/photos-to-pdf' },
      },
      {
        id: 'parents_ids',
        label: 'Parents’ ID copies',
        lockerName: 'parents-ids',
        lockerCategory: 'Documents',
        fix: { label: 'Turn photos into a PDF', route: '/studio/photos-to-pdf' },
      },
      { id: 'ecitizen_account', label: 'An eCitizen account (the applicant or a parent)' },
      { id: 'fee', label: 'Certificate fee (paid on eCitizen)' },
    ],
    steps: [
      'Sign in to eCitizen and open Civil Registration Services.',
      'Choose Birth Certificate: a first application, a late registration, or a copy of one you already had.',
      'Fill in the child’s and parents’ details and upload the documents.',
      'Pay the fee and keep the receipt.',
      'Collect the certificate at the registration office you picked when you get the message.',
    ],
    // Keys differ from My Details on purpose: the person on the certificate is
    // often the user's child, so the user's own parents mustn't be filled in.
    fields: [
      { key: 'childName', label: 'Full name of the person on the certificate' },
      { key: 'childDateOfBirth', label: 'Their date of birth', kind: 'date', placeholder: 'YYYY-MM-DD' },
      { key: 'childPlaceOfBirth', label: 'Place of birth (hospital or village)' },
      { key: 'birthEntryNumber', label: 'Birth notification or entry number', optional: true },
      { key: 'certFatherName', label: 'Father’s full name' },
      { key: 'certFatherId', label: 'Father’s ID number', kind: 'idNumber', optional: true },
      { key: 'certMotherName', label: 'Mother’s full name' },
      { key: 'certMotherId', label: 'Mother’s ID number', kind: 'idNumber', optional: true },
      ...contactFields,
      { key: 'county', label: 'County of birth' },
    ],
    payment: { howTo: eCitizenPayment },
    stages: ['Applied on eCitizen', 'Paid', 'Certificate ready', 'Collected'],
  },
  {
    id: 'sha',
    title: 'SHA registration',
    description: 'Register for the Social Health Authority cover',
    icon: 'medkit',
    agency: 'Social Health Authority (SHA)',
    portal: { label: 'Open SHA', url: 'https://sha.go.ke' },
    officialDomains: ['sha.go.ke', 'health.go.ke'],
    requirements: [
      { id: 'id_number', label: 'Your National ID number' },
      { id: 'phone', label: 'A phone number registered in your name (for the confirmation code)' },
      { id: 'household', label: 'Details of your spouse and children: names, ID or birth certificate numbers' },
      { id: 'income', label: 'Your income source and roughly what you earn (for the contribution assessment)' },
    ],
    steps: [
      'Register on the SHA website or dial *147# on your phone.',
      'Enter your ID number and confirm with the code sent to your phone.',
      'Add your household members.',
      'Answer the income questions so SHA can work out your monthly contribution.',
      'Pay the contribution as shown by SHA (salaried workers pay through their employer).',
    ],
    fields: [
      ...idFields,
      ...contactFields,
      { key: 'county', label: 'County' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'employer', label: 'Employer (if employed)', optional: true },
      { key: 'incomeSource', label: 'Main income source' },
      { key: 'householdMembers', label: 'Household members (name, relationship, ID or birth cert number)', optional: true },
    ],
    payment: {
      howTo: [
        'If you are salaried, your employer deducts the contribution from your pay.',
        'Otherwise, pay the monthly amount SHA gives you, using only the Paybill and account shown by SHA.',
        'Type your M-Pesa PIN only on your own phone. Never share it.',
        'Keep the M-Pesa message as proof of payment.',
      ],
    },
    stages: ['Registered', 'Household members added', 'Contribution assessed', 'First contribution paid', 'Cover active'],
  },
  {
    id: 'business_name',
    title: 'Business name registration',
    description: 'Register a business name with BRS',
    icon: 'storefront',
    agency: 'Business Registration Service (BRS) on eCitizen',
    portal: { label: 'Open eCitizen (BRS)', url: 'https://accounts.ecitizen.go.ke' },
    officialDomains: ['brs.go.ke', 'ecitizen.go.ke'],
    requirements: [
      idScan,
      { id: 'kra_pin', label: 'KRA PIN of every owner', lockerName: 'kra-pin', lockerCategory: 'Certificates' },
      {
        id: 'passport_photo',
        label: 'Passport photo of every owner',
        lockerName: 'passport-photo',
        lockerCategory: 'Photos',
        fix: { label: 'Make passport photo', route: '/studio/passport' },
      },
      { id: 'name_options', label: 'Three name options, in order of preference' },
      { id: 'address', label: 'Business location and postal address' },
      { id: 'fee', label: 'Name search and registration fees (paid on eCitizen)' },
    ],
    steps: [
      'Sign in to eCitizen and open Business Registration Service.',
      'Search your name options and reserve one that is available.',
      'Register the business name with the owners’ details, nature of business and address.',
      'Pay the fees.',
      'Download the business name certificate when it is approved.',
    ],
    fields: [
      ...idFields,
      { key: 'kraPin', label: 'Your KRA PIN', kind: 'kraPin' },
      ...contactFields,
      { key: 'nameOption1', label: 'Business name, first choice' },
      { key: 'nameOption2', label: 'Second choice' },
      { key: 'nameOption3', label: 'Third choice' },
      { key: 'businessNature', label: 'What the business does', placeholder: 'e.g. Retail shop selling groceries' },
      { key: 'county', label: 'County' },
      { key: 'town', label: 'Town' },
      { key: 'businessLocation', label: 'Street or building', optional: true },
      { key: 'postalAddress', label: 'Postal address and code', optional: true, placeholder: 'P.O. Box 123-00100' },
    ],
    payment: { howTo: eCitizenPayment },
    stages: ['Name reserved', 'Registration submitted', 'Paid', 'Approved', 'Certificate saved to Locker'],
  },
  {
    id: 'kra_returns',
    title: 'KRA tax returns',
    description: 'File a nil or employment return on iTax',
    icon: 'receipt',
    agency: 'Kenya Revenue Authority (iTax)',
    portal: { label: 'Open iTax', url: 'https://itax.kra.go.ke' },
    officialDomains: ['kra.go.ke'],
    requirements: [
      { id: 'kra_pin', label: 'Your KRA PIN and iTax password (never share the password)' },
      {
        id: 'p9',
        label: 'P9 form from your employer, if you were employed that year',
        lockerName: 'p9-form',
        lockerCategory: 'Documents',
      },
      { id: 'deadline', label: 'File by 30 June for the previous year to avoid a penalty' },
    ],
    steps: [
      'Sign in to iTax with your KRA PIN and password.',
      'Go to Returns, then File Return, and choose Income Tax - Resident Individual.',
      'Choose Nil return if you had no income, or fill in the employment income from your P9.',
      'Submit and download the e-return receipt.',
      'If tax is due, generate a payment slip and pay it.',
    ],
    fields: [
      { key: 'fullName', label: 'Full name' },
      { key: 'kraPin', label: 'KRA PIN', kind: 'kraPin' },
      { key: 'idNumber', label: 'ID number', kind: 'idNumber' },
      { key: 'returnYear', label: 'Year of the return', placeholder: 'e.g. 2025' },
      { key: 'returnType', label: 'Return type', placeholder: 'Nil or Employment' },
      { key: 'employer', label: 'Employer', optional: true },
      { key: 'employerPin', label: 'Employer’s KRA PIN (from P9)', optional: true, kind: 'kraPin' },
      { key: 'grossPay', label: 'Total gross pay (from P9)', optional: true },
      { key: 'payeDeducted', label: 'PAYE deducted (from P9)', optional: true },
    ],
    payment: {
      free: true,
      howTo: [
        'Filing a return is free.',
        'If iTax shows tax to pay, generate a payment slip on iTax and pay by M-Pesa using the Paybill and payment registration number on the slip.',
        'Type your M-Pesa PIN only on your own phone. Never share it or your iTax password.',
      ],
    },
    stages: ['P9 received (or nil)', 'Return filed', 'E-return receipt saved', 'Tax paid (if any was due)'],
  },
];

export function findGovTask(id: string | undefined): GovTask | undefined {
  return govTasks.find((task) => task.id === id);
}
