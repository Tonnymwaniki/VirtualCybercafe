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
  | 'kra_returns'
  // Education tasks use the same guided flow; they are listed in the
  // Education workspace instead of Government Services.
  | 'student_funding'
  | 'helb_clearance'
  | 'knec_certificate'
  // Business tasks are listed in the Business workspace.
  | 'business_permit'
  | 'turnover_tax'
  | 'company_registration'
  | 'agpo'
  // Listed in the Travel workspace.
  | 'kenya_eta';

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

// Anything the form helper can work on: a government task, or the job
// application form in data/job-portal.ts.
export type FormTask = Omit<GovTask, 'id'> & { id: string };

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

const mpesaPinWarning = 'Type your M-Pesa PIN only on your own phone’s M-Pesa prompt. Never share it with anyone, including this app.';

export const eduTasks: GovTask[] = [
  {
    id: 'student_funding',
    title: 'Student funding (HEF / HELB)',
    description: 'Scholarship and loan for university or TVET',
    icon: 'cash',
    agency: 'Higher Education Financing: the Universities Fund and HELB',
    portal: { label: 'Open the HEF portal', url: 'https://www.hef.co.ke' },
    officialDomains: ['hef.co.ke', 'helb.co.ke', 'universitiesfund.go.ke'],
    requirements: [
      { ...idScan, label: 'Your National ID (or birth certificate if you have no ID yet)' },
      { id: 'kcse_index', label: 'Your KCSE index number and year' },
      { id: 'admission_letter', label: 'Admission letter from your university or college', lockerName: 'admission-letter', lockerCategory: 'Documents' },
      { id: 'parents_ids', label: 'Parents’ or guardian’s ID copies (or death certificates)', lockerName: 'parents-ids', lockerCategory: 'Documents' },
      { id: 'phone_email', label: 'A phone number registered in your name and an email you can open' },
    ],
    steps: [
      'Get your admission letter from your university or college.',
      'Create an account on the HEF portal with your ID (or birth certificate) number and KCSE index number.',
      'Fill in your family and household details honestly; they decide your funding band.',
      'Upload the documents asked for and submit before the deadline.',
      'Check your funding band and appeal if it looks wrong.',
      'Sign the loan agreement when asked, then follow up on the money reaching your institution.',
    ],
    fields: [
      ...idFields,
      ...contactFields,
      { key: 'kcseIndex', label: 'KCSE index number' },
      { key: 'kcseYear', label: 'KCSE year' },
      { key: 'college', label: 'University or college admitted to' },
      { key: 'course', label: 'Course' },
      { key: 'admissionNumber', label: 'Admission number', optional: true },
      { key: 'fatherName', label: 'Father’s full name', optional: true },
      { key: 'fatherId', label: 'Father’s ID number', kind: 'idNumber', optional: true },
      { key: 'motherName', label: 'Mother’s full name', optional: true },
      { key: 'motherId', label: 'Mother’s ID number', kind: 'idNumber', optional: true },
      { key: 'householdIncome', label: 'Household monthly income (about)', optional: true },
      { key: 'county', label: 'Home county' },
    ],
    payment: { free: true, howTo: ['Applying for student funding is free.', 'Never pay anyone who offers to “speed up” or increase your loan.'] },
    stages: ['Account created', 'Application submitted', 'Funding band out', 'Appeal (if needed)', 'Loan agreement signed', 'Funds received'],
  },
  {
    id: 'helb_clearance',
    title: 'HELB compliance certificate',
    description: 'Proof your HELB loan is paid or on track',
    icon: 'ribbon',
    agency: 'Higher Education Loans Board (HELB)',
    portal: { label: 'Open HELB', url: 'https://www.helb.co.ke' },
    officialDomains: ['helb.co.ke'],
    requirements: [
      { id: 'helb_account', label: 'A HELB portal account (sign up with your ID number)' },
      { id: 'loan_status', label: 'Loan fully repaid, or repayments up to date' },
      { id: 'fee', label: 'Certificate fee, paid by M-Pesa to the paybill HELB shows' },
    ],
    steps: [
      'Sign in to the HELB portal.',
      'Check your loan balance and any penalties.',
      'Clear any arrears, or agree a repayment plan with HELB.',
      'Request the compliance certificate and pay the fee shown.',
      'Download the certificate and save it in your Locker.',
    ],
    fields: [
      { key: 'fullName', label: 'Full name (as on ID)' },
      { key: 'idNumber', label: 'ID number', kind: 'idNumber' },
      ...contactFields,
      { key: 'kraPin', label: 'KRA PIN', kind: 'kraPin', optional: true },
      { key: 'employer', label: 'Employer', optional: true },
    ],
    payment: {
      howTo: [
        'On the HELB portal, choose the certificate and note the amount, paybill and account number it shows.',
        'Pay with Lipa na M-Pesa > Paybill using exactly those details.',
        mpesaPinWarning,
      ],
    },
    stages: ['Signed in to HELB', 'Loan checked', 'Certificate requested', 'Paid', 'Certificate downloaded'],
  },
  {
    id: 'knec_certificate',
    title: 'Replace a lost KCSE certificate',
    description: 'Replacement certificate or result slip from KNEC',
    icon: 'document-text',
    agency: 'Kenya National Examinations Council (KNEC)',
    portal: { label: 'Open KNEC', url: 'https://www.knec.ac.ke' },
    officialDomains: ['knec.ac.ke'],
    requirements: [
      idScan,
      { id: 'police_abstract', label: 'Police abstract for the lost certificate', lockerName: 'police-abstract', lockerCategory: 'Documents' },
      { id: 'result_slip', label: 'Copy of your result slip or old certificate, if you have one', lockerName: 'result-slip', lockerCategory: 'Certificates' },
      {
        id: 'photo',
        label: 'Recent passport photo',
        lockerName: 'passport-photo',
        lockerCategory: 'Photos',
        fix: { label: 'Make passport photo', route: '/studio/passport' },
      },
      { id: 'fee', label: 'Replacement fee, paid as KNEC instructs' },
    ],
    steps: [
      'Report the loss at a police station and get a police abstract.',
      'Get the certificate replacement application form from the KNEC website or a KNEC office.',
      'Fill it in with your index number and year, and attach the documents.',
      'Pay the fee as KNEC instructs and keep the receipt.',
      'Submit the application, then collect the certificate when KNEC says it is ready.',
    ],
    fields: [
      ...idFields,
      ...contactFields,
      { key: 'school', label: 'Secondary school' },
      { key: 'kcseIndex', label: 'KCSE index number' },
      { key: 'kcseYear', label: 'KCSE year' },
    ],
    payment: {
      howTo: [
        'Pay only to the KNEC account or paybill printed on the official KNEC form or website.',
        'Keep the receipt; you attach it to the application.',
        mpesaPinWarning,
      ],
    },
    stages: ['Police abstract', 'Form filled', 'Paid', 'Submitted to KNEC', 'Certificate collected'],
  },
];

// Counties publish permit fees and forms on <county>.go.ke; the live check
// and form helper may search any county's site.
const countySites = [
  'mombasa', 'kwale', 'kilifi', 'tanariver', 'lamu', 'taitataveta', 'garissa', 'wajir', 'mandera', 'marsabit',
  'isiolo', 'meru', 'tharakanithi', 'embu', 'kitui', 'machakos', 'makueni', 'nyandarua', 'nyeri', 'kirinyaga',
  'muranga', 'kiambu', 'turkana', 'westpokot', 'samburu', 'transnzoia', 'uasingishu', 'elgeyomarakwet', 'nandi',
  'baringo', 'laikipia', 'nakuru', 'narok', 'kajiado', 'kericho', 'bomet', 'kakamega', 'vihiga', 'bungoma', 'busia',
  'siaya', 'kisumu', 'homabay', 'migori', 'kisii', 'nyamira', 'nairobi',
].map((county) => `${county}.go.ke`);

const businessFields: FormField[] = [
  { key: 'businessName', label: 'Business name' },
  { key: 'businessRegNo', label: 'Registration number', placeholder: 'e.g. BN-ABC1234' },
  { key: 'businessKraPin', label: 'Business KRA PIN', kind: 'kraPin' },
  { key: 'businessNature', label: 'What the business does' },
];

const businessCertificate: Requirement = {
  id: 'business_certificate',
  label: 'Business registration certificate (business name or company)',
  lockerName: 'business-certificate',
  lockerCategory: 'Certificates',
};

export const bizTasks: GovTask[] = [
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
    id: 'business_permit',
    title: 'County business permit',
    description: 'Single or Unified Business Permit from your county',
    icon: 'document-lock',
    agency: 'Your county government (revenue office or county website)',
    portal: { label: 'Open the Council of Governors county list', url: 'https://cog.go.ke' },
    officialDomains: ['cog.go.ke', 'nairobiservices.go.ke', ...countySites],
    requirements: [
      idScan,
      { id: 'kra_pin', label: 'KRA PIN (the business’s or yours)', lockerName: 'kra-pin', lockerCategory: 'Certificates' },
      businessCertificate,
      { id: 'location', label: 'Exact business location: plot number, building, street and ward' },
      { id: 'size', label: 'Size of the premises and number of workers (the fee depends on them)' },
      { id: 'fee', label: 'Permit fee, set by your county for your type and size of business' },
    ],
    steps: [
      'Open your county’s revenue website or visit the county revenue office.',
      'Register the business and choose the business activity that fits (the county’s fee list).',
      'Fill in the location, size of the premises and number of workers.',
      'Pay the invoice to the county’s official paybill and keep the receipt.',
      'Download or collect the permit and display it at the business. Renew it every year.',
    ],
    fields: [
      { key: 'fullName', label: 'Owner’s full name' },
      { key: 'idNumber', label: 'Owner’s ID number', kind: 'idNumber' },
      ...contactFields,
      ...businessFields,
      { key: 'county', label: 'County' },
      { key: 'town', label: 'Town' },
      { key: 'businessLocation', label: 'Street or building' },
      { key: 'plotNumber', label: 'Plot number', optional: true },
      { key: 'premisesSize', label: 'Size of the premises', optional: true, placeholder: 'e.g. 3m by 4m shop' },
      { key: 'workers', label: 'Number of workers', optional: true },
    ],
    payment: {
      howTo: [
        'Pay only to the county paybill or bank account printed on the county invoice or county website.',
        'Put the invoice or bill number as the account number, exactly as shown.',
        'County officers should not ask for cash or payment to a personal number.',
        mpesaPinWarning,
      ],
    },
    stages: ['Applied', 'Invoice paid', 'Inspection (if needed)', 'Permit received', 'Permit saved to Locker'],
  },
  {
    id: 'turnover_tax',
    title: 'Turnover tax (TOT)',
    description: 'Monthly return on iTax for small businesses',
    icon: 'calculator',
    agency: 'Kenya Revenue Authority (iTax)',
    portal: { label: 'Open iTax', url: 'https://itax.kra.go.ke' },
    officialDomains: ['kra.go.ke'],
    requirements: [
      { id: 'kra_pin', label: 'KRA PIN with the turnover tax obligation, and your iTax password (never share it)' },
      { id: 'sales', label: 'Total sales for the month (from your records, invoices and M-Pesa statements)' },
      { id: 'eligible', label: 'Turnover tax is for businesses whose yearly sales fall in the KRA turnover tax band' },
      { id: 'deadline', label: 'File and pay by the 20th of the next month, even if sales were zero' },
    ],
    steps: [
      'Add up the month’s sales from your records.',
      'Sign in to iTax, go to Returns, then File Return, and choose Turnover Tax.',
      'Enter the month and the total sales, then submit and download the receipt.',
      'Generate a payment slip for the tax shown.',
      'Pay by M-Pesa using KRA’s paybill and the payment registration number on the slip.',
    ],
    fields: [
      { key: 'fullName', label: 'Owner’s full name' },
      { key: 'businessKraPin', label: 'KRA PIN used for the business', kind: 'kraPin' },
      { key: 'businessName', label: 'Business name', optional: true },
      { key: 'taxMonth', label: 'Month of the return', placeholder: 'e.g. August 2026' },
      { key: 'monthSales', label: 'Total sales that month (KSh)' },
    ],
    payment: {
      howTo: [
        'Filing is free. The tax is a percentage of the month’s sales; iTax works it out.',
        'Generate a payment slip on iTax, then pay with M-Pesa to KRA’s paybill using the payment registration number on the slip.',
        'Type your M-Pesa PIN only on your own phone. Never share it or your iTax password.',
      ],
    },
    stages: ['Sales added up', 'Return filed', 'Payment slip generated', 'Tax paid', 'Receipt saved'],
  },
  {
    id: 'company_registration',
    title: 'Register a limited company',
    description: 'Private limited company with BRS',
    icon: 'business',
    agency: 'Business Registration Service (BRS) on eCitizen',
    portal: { label: 'Open eCitizen (BRS)', url: 'https://accounts.ecitizen.go.ke' },
    officialDomains: ['brs.go.ke', 'ecitizen.go.ke'],
    requirements: [
      { ...idScan, label: 'National ID of every director and shareholder' },
      { id: 'kra_pins', label: 'KRA PIN of every director and shareholder', lockerName: 'kra-pin', lockerCategory: 'Certificates' },
      {
        id: 'passport_photo',
        label: 'Passport photo of every director',
        lockerName: 'passport-photo',
        lockerCategory: 'Photos',
        fix: { label: 'Make passport photo', route: '/studio/passport' },
      },
      { id: 'name_options', label: 'Company name options, in order of preference' },
      { id: 'office', label: 'Registered office address (county, town, building, postal address)' },
      { id: 'shares', label: 'Share capital and how many shares each shareholder holds' },
      { id: 'contacts', label: 'Phone and email of every director (each one confirms on eCitizen)' },
      { id: 'fee', label: 'Name reservation and registration fees (paid on eCitizen)' },
    ],
    steps: [
      'Sign in to eCitizen and open Business Registration Service.',
      'Search and reserve a company name.',
      'Choose Private Limited Company and add the directors, shareholders, shares and registered office.',
      'Pay the fees; every director then confirms the application from their own eCitizen account.',
      'Download the certificate of incorporation and the CR12 when approved.',
    ],
    fields: [
      ...idFields,
      { key: 'kraPin', label: 'Your KRA PIN', kind: 'kraPin' },
      ...contactFields,
      { key: 'nameOption1', label: 'Company name, first choice' },
      { key: 'nameOption2', label: 'Second choice' },
      { key: 'businessNature', label: 'What the company will do' },
      { key: 'shareCapital', label: 'Share capital (KSh)', placeholder: 'e.g. 100,000' },
      { key: 'otherDirectors', label: 'Other directors (names and ID numbers)', optional: true },
      { key: 'county', label: 'County' },
      { key: 'town', label: 'Town' },
      { key: 'businessLocation', label: 'Building and street of the office' },
      { key: 'postalAddress', label: 'Postal address and code', optional: true, placeholder: 'P.O. Box 123-00100' },
    ],
    payment: { howTo: eCitizenPayment },
    stages: ['Name reserved', 'Application filled', 'Paid', 'Directors confirmed', 'Certificate saved to Locker'],
  },
  {
    id: 'agpo',
    title: 'AGPO certificate',
    description: 'Government tenders reserved for youth, women and PWD',
    icon: 'ribbon',
    agency: 'National Treasury, Access to Government Procurement Opportunities',
    portal: { label: 'Open AGPO', url: 'https://agpo.go.ke' },
    officialDomains: ['agpo.go.ke', 'treasury.go.ke', 'tenders.go.ke', 'ppra.go.ke'],
    requirements: [
      businessCertificate,
      { id: 'ownership', label: 'Youth (18–35), women or persons with disability own and run the business (check AGPO’s ownership rule)' },
      { id: 'owner_ids', label: 'National ID of every owner or director', lockerName: 'national-id', lockerCategory: 'Documents' },
      { id: 'kra_pin', label: 'The business’s KRA PIN certificate', lockerName: 'kra-pin', lockerCategory: 'Certificates' },
      { id: 'tcc', label: 'Tax compliance certificate from iTax', lockerName: 'tax-compliance', lockerCategory: 'Certificates' },
      { id: 'cr12', label: 'CR12 or partnership deed, for companies and partnerships', lockerName: 'cr12', lockerCategory: 'Certificates' },
      { id: 'ncpwd', label: 'NCPWD card, for persons with disability', lockerName: 'ncpwd', lockerCategory: 'Certificates' },
    ],
    steps: [
      'Get a tax compliance certificate on iTax if you do not have a valid one.',
      'Create an account on the AGPO portal.',
      'Fill in the business and owners’ details and choose your group (youth, women or PWD).',
      'Upload the documents and submit.',
      'When approved, download the AGPO certificate and save it to your Locker.',
    ],
    fields: [
      ...businessFields,
      { key: 'agpoCategory', label: 'AGPO group', placeholder: 'Youth, Women or PWD' },
      { key: 'fullName', label: 'Owner’s full name' },
      { key: 'idNumber', label: 'Owner’s ID number', kind: 'idNumber' },
      { key: 'dateOfBirth', label: 'Owner’s date of birth', kind: 'date', placeholder: 'YYYY-MM-DD' },
      ...contactFields,
      { key: 'county', label: 'County' },
    ],
    payment: {
      free: true,
      howTo: ['AGPO registration is free. Anyone asking you to pay to get an AGPO certificate or a tender is a conman.'],
    },
    stages: ['Tax compliance certificate', 'Account created', 'Submitted', 'Approved', 'Certificate saved to Locker'],
  },
];

export const travelTasks: GovTask[] = [
  {
    id: 'kenya_eta',
    title: 'Kenya eTA for a visitor',
    description: 'Invite a relative or friend from abroad',
    icon: 'people',
    agency: 'Kenya Directorate of Immigration Services (eTA)',
    portal: { label: 'Open Kenya eTA', url: 'https://www.etakenya.go.ke' },
    officialDomains: ['etakenya.go.ke', 'immigration.go.ke', 'ecitizen.go.ke'],
    requirements: [
      { id: 'visitor_passport', label: 'The visitor’s passport, valid 6 months after arrival, with a blank page' },
      { id: 'visitor_photo', label: 'A recent face photo of the visitor' },
      { id: 'tickets', label: 'The visitor’s return or onward ticket booking' },
      {
        id: 'invitation',
        label: 'Your invitation letter, or their hotel booking',
        lockerName: 'invitation-letter',
        lockerCategory: 'Documents',
      },
      { id: 'host_id', label: 'Your National ID (as the host)', lockerName: 'national-id', lockerCategory: 'Documents' },
      { id: 'fee', label: 'The eTA fee, paid by card on the official eTA site' },
    ],
    steps: [
      'The visitor (or you, for them) opens the official Kenya eTA site: etakenya.go.ke.',
      'Fill in the visitor’s passport details, travel dates and where they will stay.',
      'Upload their photo, passport page, ticket and your invitation letter or their hotel booking.',
      'Pay the fee on the site and submit, well before the trip.',
      'The approved eTA arrives by email; they carry a copy when travelling.',
    ],
    fields: [
      { key: 'visitorName', label: 'Visitor’s full name (as in passport)' },
      { key: 'visitorNationality', label: 'Visitor’s nationality' },
      { key: 'visitorPassport', label: 'Visitor’s passport number' },
      { key: 'visitorEmail', label: 'Visitor’s email', kind: 'email', optional: true },
      { key: 'arrivalDate', label: 'Arrival date', kind: 'date', placeholder: 'YYYY-MM-DD' },
      { key: 'departureDate', label: 'Departure date', kind: 'date', placeholder: 'YYYY-MM-DD' },
      { key: 'fullName', label: 'Your name (the host)' },
      { key: 'idNumber', label: 'Your ID number', kind: 'idNumber' },
      { key: 'phone', label: 'Your phone number', kind: 'phone', placeholder: '07XX XXX XXX' },
      { key: 'town', label: 'Town where they will stay' },
      { key: 'postalAddress', label: 'Your address', optional: true },
    ],
    payment: {
      howTo: [
        'Pay only on the official site, etakenya.go.ke. Look-alike sites charge extra.',
        'The fee is paid by card on the site. Keep the receipt email.',
      ],
    },
    stages: ['Details gathered', 'Application submitted', 'Paid', 'eTA approved', 'Visitor arrived'],
  },
];

export function findGovTask(id: string | undefined): GovTask | undefined {
  return [...govTasks, ...eduTasks, ...bizTasks, ...travelTasks].find((task) => task.id === id);
}
