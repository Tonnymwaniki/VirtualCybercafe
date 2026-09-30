// Shapes shared by the Travel workspace screens, the /api/travel route and
// the travel agent. Trips are private records in task_progress
// (lib/record-store.ts).

export const TRIP_KEY = 'travel:trip:';

export type TripPurpose = 'visit' | 'tourism' | 'study' | 'work' | 'business' | 'medical';

export const purposeLabel: Record<TripPurpose, string> = {
  visit: 'Visit family or friends',
  tourism: 'Holiday',
  study: 'Study',
  work: 'Work',
  business: 'Business trip',
  medical: 'Medical treatment',
};

export const tripPurposes = Object.keys(purposeLabel) as TripPurpose[];

export type VisaNeed = 'no' | 'on_arrival' | 'eta' | 'evisa' | 'embassy' | 'unknown';

export const visaNeedLabel: Record<VisaNeed, string> = {
  no: 'No visa needed',
  on_arrival: 'Visa on arrival',
  eta: 'Online travel authorisation (eTA) before you fly',
  evisa: 'eVisa: apply online before you fly',
  embassy: 'Visa from the embassy or visa centre before you fly',
  unknown: 'Not clear: check the official site',
};

export type Source = { title: string; url: string };

export type VisaCheck = {
  need: VisaNeed;
  visaType: string;
  summary: string;
  documents: string[];
  fee: string;
  processingTime: string;
  howToApply: string;
  officialUrl: string;
  warnings: string[];
  sources: Source[];
  checkedAt: string;
  mode: 'ai' | 'sample';
};

export type LetterKind = 'cover' | 'invitation' | 'sponsor' | 'itinerary';

export const letterKinds: Record<LetterKind, { label: string; description: string; question: string }> = {
  cover: {
    label: 'Embassy cover letter',
    description: 'Explains your trip and that you will return',
    question: 'Anything to mention? (job, family, why you will come back)',
  },
  invitation: {
    label: 'Invitation letter',
    description: 'From you, inviting a visitor to Kenya',
    question: 'Who are you inviting? (name, passport number, relationship)',
  },
  sponsor: {
    label: 'Sponsor letter',
    description: 'From the person paying for the trip',
    question: 'Who is the sponsor? (name, relationship, job, what they will pay)',
  },
  itinerary: {
    label: 'Travel itinerary',
    description: 'Day-by-day plan with flights and stays',
    question: 'Flights, places and where you will stay, as far as you know',
  },
};

export const letterKindList = Object.keys(letterKinds) as LetterKind[];

export type TripLetter = { title: string; body: string; writtenAt: string; mode: 'ai' | 'sample' };

export type Trip = {
  id: string;
  destination: string;
  purpose: TripPurpose;
  // YYYY-MM-DD, may be empty until known.
  departDate: string;
  returnDate: string;
  check: VisaCheck | null;
  // Indexes of check.documents the traveller has ready.
  ready: number[];
  // Highest stage reached in tripStages, -1 for none.
  stage: number;
  formAnswers: Record<string, string>;
  letters: Partial<Record<LetterKind, TripLetter>>;
  createdAt: string;
};

export type LetterResult = { letter: TripLetter | null; problem: string };

// ---- Work abroad ----

export type AgencyStatus = 'listed' | 'not_listed' | 'revoked' | 'unclear';

export type AgencyCheck = {
  status: AgencyStatus;
  name: string;
  detail: string;
  sources: Source[];
  mode: 'ai' | 'sample';
};
