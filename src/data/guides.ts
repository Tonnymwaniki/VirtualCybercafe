// Step-by-step guides the attendant can look up. Fees change often, so the
// guides point to the official site; the attendant can web-search for the
// latest figure.

export type ServiceGuide = {
  id: string;
  title: string;
  where: string;
  officialUrl: string;
  youNeed: string[];
  steps: string[];
  appTools: AppToolId[];
};

export type AppToolId =
  | 'passport_photo'
  | 'photos_to_pdf'
  | 'shrink_photo'
  | 'cv_builder'
  | 'locker'
  | 'sign_in'
  | 'government'
  | 'my_details'
  | 'jobs'
  | 'education'
  | 'print';

export const appTools: Record<AppToolId, { label: string; route: string }> = {
  passport_photo: { label: 'Prepare passport photo', route: '/studio/passport' },
  photos_to_pdf: { label: 'Turn photos into a PDF', route: '/studio/photos-to-pdf' },
  shrink_photo: { label: 'Shrink a photo', route: '/studio/compress' },
  cv_builder: { label: 'Build my CV', route: '/cv' },
  locker: { label: 'Open my Locker', route: '/locker' },
  sign_in: { label: 'Sign in', route: '/sign-in' },
  government: { label: 'Open Government Services', route: '/gov' },
  my_details: { label: 'Open My Details', route: '/profile' },
  jobs: { label: 'Open Jobs & Career', route: '/jobs' },
  education: { label: 'Open Education', route: '/education' },
  print: { label: 'Send to Print Hub', route: '/print' },
};

export const guides: ServiceGuide[] = [
  {
    id: 'passport',
    title: 'Kenyan passport (new or renewal)',
    where: 'eCitizen, Department of Immigration',
    officialUrl: 'https://www.ecitizen.go.ke',
    youNeed: [
      'National ID (front and back scanned)',
      'Birth certificate',
      'Passport photo, 600×600 px, under 200 KB, white background',
      'Recommender’s ID copy and details',
      'Old passport, if renewing',
      'Application fee, paid on eCitizen (M-Pesa or card)',
    ],
    steps: [
      'Sign in to eCitizen and open Department of Immigration Services.',
      'Choose Passport, then the passport type (34, 50 or 66 pages).',
      'Fill in your details and upload the scanned documents and photo.',
      'Pay the fee shown on eCitizen and download the application form.',
      'Book an appointment and take the printed form and originals for biometrics.',
    ],
    appTools: ['passport_photo', 'photos_to_pdf', 'locker'],
  },
  {
    id: 'kra_pin',
    title: 'KRA PIN registration',
    where: 'KRA iTax',
    officialUrl: 'https://itax.kra.go.ke',
    youNeed: ['National ID number', 'Email address you can open', 'Phone number', 'Physical address'],
    steps: [
      'Open iTax and choose New PIN Registration.',
      'Pick Individual and Online form.',
      'Enter your ID details, contacts and address.',
      'Submit; the PIN certificate is sent to your email.',
    ],
    appTools: ['locker'],
  },
  {
    id: 'good_conduct',
    title: 'Police clearance (Certificate of Good Conduct)',
    where: 'eCitizen, Directorate of Criminal Investigations',
    officialUrl: 'https://www.ecitizen.go.ke',
    youNeed: ['National ID', 'Fee paid on eCitizen', 'Fingerprints taken at a DCI centre or Huduma Centre'],
    steps: [
      'On eCitizen, open DCI and apply for Police Clearance Certificate.',
      'Pay the fee and print the invoice and C24 fingerprint form.',
      'Visit a DCI office or Huduma Centre for fingerprints.',
      'Download the certificate from eCitizen when it is ready.',
    ],
    appTools: ['photos_to_pdf', 'locker'],
  },
  {
    id: 'helb',
    title: 'HELB loan application',
    where: 'HELB student portal',
    officialUrl: 'https://www.helb.co.ke',
    youNeed: [
      'National ID',
      'KCSE index number and year',
      'Admission letter',
      'Parents’ or guardians’ ID numbers',
      'Guarantor details',
    ],
    steps: [
      'Register or sign in on the HELB portal.',
      'Choose the correct loan product for your level.',
      'Fill in your details and upload the documents asked for.',
      'Submit, print the form, and get it signed and stamped as instructed.',
    ],
    appTools: ['photos_to_pdf', 'shrink_photo', 'locker'],
  },
  {
    id: 'kuccps',
    title: 'KUCCPS course application or revision',
    where: 'KUCCPS student portal',
    officialUrl: 'https://students.kuccps.net',
    youNeed: ['KCSE index number and year', 'Birth certificate number or KCPE index', 'Application fee'],
    steps: [
      'Sign in to the KUCCPS student portal.',
      'Check which programmes you qualify for.',
      'Pick your courses in order of preference.',
      'Pay the fee and submit before the deadline.',
    ],
    appTools: ['locker'],
  },
  {
    id: 'driving_licence',
    title: 'Driving licence renewal (smart DL)',
    where: 'NTSA eCitizen',
    officialUrl: 'https://www.ecitizen.go.ke',
    youNeed: ['Current driving licence number', 'National ID', 'Fee paid on eCitizen'],
    steps: [
      'On eCitizen, open NTSA services and choose Renew Driving Licence.',
      'Pick the renewal period and pay.',
      'Download the receipt; keep it as proof until the licence updates.',
    ],
    appTools: ['locker'],
  },
  {
    id: 'business_name',
    title: 'Business name registration',
    where: 'Business Registration Service on eCitizen',
    officialUrl: 'https://brs.go.ke',
    youNeed: ['National ID and KRA PIN of each owner', 'Three name options', 'Business address', 'Fee'],
    steps: [
      'On eCitizen, open Business Registration Service.',
      'Search and reserve a business name.',
      'Register the business name with owners’ details and address.',
      'Pay and download the registration certificate.',
    ],
    appTools: ['photos_to_pdf', 'locker'],
  },
  {
    id: 'job_application',
    title: 'Applying for a job',
    where: 'The employer’s website, email or job portal',
    officialUrl: 'https://www.publicservice.go.ke',
    youNeed: ['Up-to-date CV', 'Cover letter for this job', 'Copies of certificates and ID', 'Referees'],
    steps: [
      'Read the advert and note the requirements and deadline.',
      'Tailor your CV and write a cover letter for the role.',
      'Combine certificates into one PDF if the portal asks for a single upload.',
      'Submit before the deadline and keep a copy.',
    ],
    appTools: ['cv_builder', 'photos_to_pdf', 'locker'],
  },
];
