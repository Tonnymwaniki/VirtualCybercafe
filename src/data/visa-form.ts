// The visa application form: the details most embassy and eVisa forms ask
// for. The form helper works on it like a government form, filling it from
// My Details and the trip.

import type { FormTask } from '@/data/gov-tasks';

export const tripStages = ['Documents gathered', 'Form filled', 'Fee paid', 'Appointment or biometrics', 'Visa received', 'Travelled'];

export const visaFormTask: FormTask = {
  id: 'visa_form',
  title: 'Visa application',
  description: 'The details visa forms ask for',
  icon: 'airplane',
  agency: 'the embassy or eVisa site of the country you are visiting',
  portal: { label: 'Open the visa site', url: 'https://www.mfa.go.ke' },
  officialDomains: [
    'mfa.go.ke',
    'immigration.go.ke',
    'vfsglobal.com',
    'tlscontact.com',
    'travel.state.gov',
    'gov.uk',
    'canada.ca',
    'homeaffairs.gov.au',
    'europa.eu',
  ],
  requirements: [
    { id: 'passport', label: 'Passport valid at least 6 months after you return, with blank pages', lockerName: 'passport', lockerCategory: 'Documents' },
    { id: 'photo', label: 'Visa photo in the size the country asks for', lockerName: 'passport-photo', lockerCategory: 'Photos' },
    { id: 'bank', label: 'Bank statements (usually the last 3 to 6 months)', lockerName: 'bank-statement', lockerCategory: 'Documents' },
    { id: 'letter', label: 'Cover letter, invitation or admission letter', lockerCategory: 'Documents' },
  ],
  steps: [
    'Open the official visa site of the country (or its visa centre, such as VFS or TLScontact).',
    'Fill in the form with the details below, exactly as in your passport.',
    'Upload or bring the documents and pay the fee on the official site.',
    'Book and attend the appointment for fingerprints or an interview, if asked.',
    'Track the application and collect your passport.',
  ],
  fields: [
    { key: 'fullName', label: 'Full name (as in passport)' },
    { key: 'sex', label: 'Sex' },
    { key: 'dateOfBirth', label: 'Date of birth', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { key: 'placeOfBirth', label: 'Place of birth' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'maritalStatus', label: 'Marital status' },
    { key: 'passportNumber', label: 'Passport number' },
    { key: 'passportIssued', label: 'Passport date of issue', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { key: 'passportExpiry', label: 'Passport expiry date', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { key: 'passportPlace', label: 'Passport place of issue' },
    { key: 'phone', label: 'Phone number', kind: 'phone', placeholder: '07XX XXX XXX' },
    { key: 'email', label: 'Email address', kind: 'email', placeholder: 'you@example.com' },
    { key: 'postalAddress', label: 'Home address', placeholder: 'P.O. Box 123-00100, Nairobi' },
    { key: 'occupation', label: 'Occupation' },
    { key: 'employer', label: 'Employer or school', optional: true },
    { key: 'tripDestination', label: 'Country you are going to' },
    { key: 'tripPurpose', label: 'Purpose of the trip' },
    { key: 'arrivalDate', label: 'Arrival date', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { key: 'departureDate', label: 'Return date', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { key: 'addressAbroad', label: 'Where you will stay (hotel or host address)' },
    { key: 'hostDetails', label: 'Host or inviting person (name, phone)', optional: true },
    { key: 'fundedBy', label: 'Who pays for the trip', placeholder: 'Myself, my employer, my sponsor...' },
  ],
  payment: {
    howTo: [
      'Pay the visa fee only on the official visa site or at the official visa centre.',
      'Agents who promise a visa for an extra fee cannot speed up or guarantee a visa.',
      'Type your M-Pesa PIN or card PIN only on your own phone or card machine. Never share it with anyone, including this app.',
    ],
  },
  stages: tripStages,
};
