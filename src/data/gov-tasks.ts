// The Government Services workspace: one guided flow per task. Fees and
// requirements change, so the "What you need" step checks the official sites
// live; the lists here are the starting point and the offline fallback.

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { LockerCategory } from '@/data/locker';
import type { IdDetails } from '@/lib/gov-types';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type GovTaskId = 'good_conduct' | 'kra_pin' | 'passport' | 'lost_id';

export type Requirement = {
  id: string;
  label: string;
  // Documents can be kept in the Locker; the file name starts with lockerName.
  lockerName?: string;
  lockerCategory?: LockerCategory;
  // An app tool that helps prepare this document.
  fix?: { label: string; route: string };
};

export type FormField = {
  key: string;
  label: string;
  // Filled from the ID details saved in the profile.
  idField?: keyof IdDetails;
  placeholder?: string;
  optional?: boolean;
  kind?: 'text' | 'email' | 'phone' | 'date' | 'idNumber' | 'kraPin';
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
  { key: 'fullName', label: 'Full name (as on ID)', idField: 'fullName' },
  { key: 'idNumber', label: 'ID number', idField: 'idNumber', kind: 'idNumber' },
  { key: 'dateOfBirth', label: 'Date of birth', idField: 'dateOfBirth', kind: 'date', placeholder: 'YYYY-MM-DD' },
  { key: 'sex', label: 'Sex', idField: 'sex' },
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
      { key: 'placeOfBirth', label: 'Place of birth (district)', idField: 'placeOfBirth' },
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
      { key: 'placeOfBirth', label: 'Place of birth', idField: 'placeOfBirth' },
      ...contactFields,
      { key: 'passportType', label: 'Passport type', placeholder: '34, 50 or 66 pages' },
      { key: 'fatherName', label: 'Father’s full name' },
      { key: 'fatherId', label: 'Father’s ID number', kind: 'idNumber', optional: true },
      { key: 'motherName', label: 'Mother’s full name' },
      { key: 'motherId', label: 'Mother’s ID number', kind: 'idNumber', optional: true },
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
];

export function findGovTask(id: string | undefined): GovTask | undefined {
  return govTasks.find((task) => task.id === id);
}
