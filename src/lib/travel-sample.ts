// Plain rules for the Travel workspace: passport validity, stand-ins for the
// travel agent when the AI is off, and work-abroad scam signs.

import type { Profile } from '@/data/profile-fields';
import { mergeSignals } from '@/lib/job-scam';
import {
  letterKinds,
  purposeLabel,
  type LetterKind,
  type Trip,
  type TripLetter,
  type TripPurpose,
  type VisaCheck,
} from '@/lib/travel-types';

function toDate(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : null;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

// Most countries want the passport valid 6 months after the trip ends.
export function passportWarning(expiry: string, trip: Pick<Trip, 'departDate' | 'returnDate'>): string | null {
  const ends = toDate(expiry);
  if (!expiry.trim()) return 'Add your passport expiry date in My Details so I can check it’s valid long enough.';
  if (!ends) return 'Your passport expiry date in My Details should look like YYYY-MM-DD.';
  const tripEnd = toDate(trip.returnDate) ?? toDate(trip.departDate) ?? new Date();
  if (ends < tripEnd) return 'Your passport expires before this trip ends. Renew it first.';
  if (ends < addMonths(tripEnd, 6)) {
    return 'Your passport expires less than 6 months after this trip. Most countries will refuse it, so renew it first.';
  }
  return null;
}

// Whole days until the trip; null when there is no date.
export function daysToTrip(departDate: string): number | null {
  const date = toDate(departDate);
  if (!date) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

export function tripCountdown(departDate: string): string {
  const days = daysToTrip(departDate);
  if (days === null) return 'No travel date yet';
  if (days < 0) return 'Travelled';
  if (days === 0) return 'Travelling today';
  if (days === 1) return 'Travelling tomorrow';
  return `${days} days to go`;
}

const purposeDocs: Record<TripPurpose, string[]> = {
  visit: ['Invitation letter from your host, with a copy of their ID or residence permit'],
  tourism: ['Hotel bookings and a day-by-day itinerary'],
  study: ['Admission letter from the school', 'Proof you can pay the fees and living costs'],
  work: ['Signed job contract and a work permit or work visa approval', 'Certificate of Good Conduct'],
  business: ['Invitation letter from the company you will visit', 'Letter from your employer'],
  medical: ['Letter from the hospital abroad', 'Proof you can pay for the treatment'],
};

export function sampleVisaCheck(destination: string, purpose: TripPurpose): VisaCheck {
  return {
    need: 'unknown',
    visaType: purposeLabel[purpose],
    summary: `Turn on the AI to check the official rules for Kenyans going to ${destination || 'this country'}. These are the documents most countries ask for.`,
    documents: [
      'Passport valid at least 6 months after you return, with blank pages',
      'Visa photo in the size the country asks for',
      'Return flight booking',
      'Bank statements for the last 3 to 6 months',
      ...purposeDocs[purpose],
    ],
    fee: '',
    processingTime: '',
    howToApply: 'Check the country’s official embassy or immigration website.',
    officialUrl: '',
    warnings: [],
    sources: [],
    checkedAt: new Date().toISOString(),
    mode: 'sample',
  };
}

export function sampleLetter(kind: LetterKind, trip: Trip, profile: Profile, notes: string): TripLetter {
  const name = profile.fullName || 'Your name';
  const dates = [trip.departDate, trip.returnDate].filter(Boolean).join(' to ') || 'the planned dates';
  const contact = [profile.postalAddress, profile.phone, profile.email].filter(Boolean).join('\n');
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const bodies: Record<LetterKind, string> = {
    cover: `${name}\n${contact}\n\n${today}\n\nThe Visa Officer\nEmbassy of ${trip.destination}\n\nDear Sir or Madam,\n\nRE: VISA APPLICATION, ${name.toUpperCase()}, PASSPORT ${profile.passportNumber || '________'}\n\nI am applying for a visa to travel to ${trip.destination} for ${purposeLabel[trip.purpose].toLowerCase()}, from ${dates}.\n\n${notes.trim() || 'I will return to Kenya at the end of my visit.'}\n\nI have attached the supporting documents. Thank you for considering my application.\n\nYours faithfully,\n\n${name}`,
    invitation: `${name}\n${contact}\n\n${today}\n\nTo whom it may concern,\n\nRE: INVITATION LETTER\n\nI, ${name}, ID number ${profile.idNumber || '________'}, invite ${notes.trim() || '(visitor’s name, passport number and relationship)'} to visit me in Kenya from ${dates}. They will stay with me at the address above.\n\nYours faithfully,\n\n${name}`,
    sponsor: `${notes.trim() || '(Sponsor’s name, address and phone)'}\n\n${today}\n\nThe Visa Officer\nEmbassy of ${trip.destination}\n\nDear Sir or Madam,\n\nRE: SPONSORSHIP OF ${name.toUpperCase()}\n\nI confirm that I will pay for the trip of ${name}, passport ${profile.passportNumber || '________'}, to ${trip.destination} from ${dates}.\n\nYours faithfully,\n\n(Sponsor’s name and signature)`,
    itinerary: `TRAVEL ITINERARY: ${name}\nPassport: ${profile.passportNumber || '________'}\nDestination: ${trip.destination}\nDates: ${dates}\n\n${notes.trim() || 'Add your flights, places and where you will stay.'}`,
  };
  return { title: letterKinds[kind].label, body: bodies[kind], writtenAt: new Date().toISOString(), mode: 'sample' };
}

// ---- Work abroad scam signs ----

const abroadRules: { pattern: RegExp; warning: string }[] = [
  {
    pattern: /\b(processing|registration|placement|booking|medical|visa|ticket|training|commitment)\s+(fees?|charges?)\b/i,
    warning: 'It asks you to pay fees up front. Registered agencies may only charge what the law allows, and never to hold a job for you.',
  },
  {
    pattern: /\b(send|pay|deposit)\b[^.\n]{0,40}\b(m-?pesa|to\s+07\d{2}|to\s+\+?2547|paybill|till)\b/i,
    warning: 'It asks you to send money to a phone number or till. Pay only to a registered agency’s company account, and get a receipt.',
  },
  {
    pattern: /\b(tourist|visit(or)?|holiday)\s+visa\b/i,
    warning: 'It mentions a tourist or visitor visa for a job. Working on a visitor visa is illegal and leaves you unprotected. You need a work visa.',
  },
  {
    pattern: /\b(no\s+interview|guaranteed\s+(job|visa|placement)|100%\s+(guaranteed|placement))\b/i,
    warning: 'It promises a guaranteed job or visa. No one can guarantee a visa.',
  },
  {
    pattern: /\b(surrender|hand\s+over|leave)\s+(your\s+)?passport\b/i,
    warning: 'It asks you to hand over your passport. Your passport should stay with you.',
  },
  {
    pattern: /\bwhats\s?app\s+(only|us\s+only)\b/i,
    warning: 'It recruits on WhatsApp only. Check the agency on the National Employment Authority list first.',
  },
];

export function abroadScamSignals(text: string): string[] {
  return mergeSignals(abroadRules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.warning));
}
