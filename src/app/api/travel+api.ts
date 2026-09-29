import Anthropic from '@anthropic-ai/sdk';

import { cleanProfile } from '@/data/profile-fields';
import { sampleLetter, sampleVisaCheck } from '@/lib/travel-sample';
import {
  letterKindList,
  tripPurposes,
  type AgencyCheck,
  type LetterKind,
  type LetterResult,
  type Trip,
  type TripPurpose,
} from '@/lib/travel-types';
import { checkAgency, checkVisa, writeLetter } from '@/server/travel-agent';
import { withUsage } from '@/server/usage';

function str(value: unknown, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function date(value: unknown) {
  const text = str(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function purposeOf(value: unknown): TripPurpose {
  return tripPurposes.find((p) => p === value) ?? 'visit';
}

// Only the trip facts the letter needs; the rest of the trip stays on the device.
function tripFrom(value: unknown): Trip | null {
  if (!value || typeof value !== 'object') return null;
  const t = value as Record<string, unknown>;
  const destination = str(t.destination, 80);
  if (!destination) return null;
  return {
    id: '',
    destination,
    purpose: purposeOf(t.purpose),
    departDate: date(t.departDate),
    returnDate: date(t.returnDate),
    check: null,
    ready: [],
    stage: -1,
    formAnswers: {},
    letters: {},
    createdAt: '',
  };
}

export function POST(request: Request) {
  return withUsage(request, 'travel', () => handle(request));
}

async function handle(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  try {
    if (body.action === 'visa') {
      const destination = str(body.destination, 80);
      if (!destination) return Response.json({ error: 'Say where you are going' }, { status: 400 });
      const purpose = purposeOf(body.purpose);
      if (!hasKey) return Response.json(sampleVisaCheck(destination, purpose));
      const check = await checkVisa(destination, purpose);
      return check ? Response.json(check) : Response.json({ error: 'Couldn’t check that destination' }, { status: 502 });
    }

    if (body.action === 'letter') {
      const kind = letterKindList.find((k) => k === body.kind) as LetterKind | undefined;
      const trip = tripFrom(body.trip);
      if (!kind || !trip) return Response.json({ error: 'Unknown letter or trip' }, { status: 400 });
      const profile = body.profile && typeof body.profile === 'object' ? cleanProfile(body.profile as Record<string, unknown>) : {};
      const notes = str(body.notes, 1500);
      if (!hasKey) return Response.json({ letter: sampleLetter(kind, trip, profile, notes), problem: '' } satisfies LetterResult);
      const letter = await writeLetter(kind, trip, profile, notes);
      return Response.json({ letter, problem: letter ? '' : 'I couldn’t write that one. Try adding more notes.' } satisfies LetterResult);
    }

    if (body.action === 'agency') {
      const name = str(body.name, 120);
      if (!name) return Response.json({ error: 'Type the agency name' }, { status: 400 });
      if (!hasKey) {
        return Response.json({
          status: 'unclear',
          name,
          detail: 'Turn on the AI to check the official list, or search the agency on nea.go.ke yourself.',
          sources: [{ title: 'National Employment Authority', url: 'https://www.nea.go.ke' }],
          mode: 'sample',
        } satisfies AgencyCheck);
      }
      const check = await checkAgency(name);
      return check ? Response.json(check) : Response.json({ error: 'Couldn’t check that agency' }, { status: 502 });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error(error);
    }
    return Response.json({ error: 'The travel helper is unavailable right now' }, { status: 502 });
  }
}
