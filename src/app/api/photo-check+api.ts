import Anthropic from '@anthropic-ai/sdk';

import type { PhotoVerdict } from '@/lib/photo-check-types';
import { checkPhoto } from '@/server/photo-check';
import { withUsage } from '@/server/usage';

// The app sends a small copy (about 800 px), far below this.
const MAX_IMAGE_BASE64 = 2_000_000;

export function POST(request: Request) {
  return withUsage(request, 'photo', () => handle(request));
}

async function handle(request: Request) {
  let image: unknown;
  try {
    image = (await request.json())?.image;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof image !== 'string' || !image || image.length > MAX_IMAGE_BASE64) {
    return Response.json({ error: 'Send one photo' }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ available: false, reason: 'The AI photo check isn’t switched on for this server yet.' } satisfies PhotoVerdict);
  }
  try {
    return Response.json(await checkPhoto(image));
  } catch (error) {
    console.error(error instanceof Anthropic.APIError ? `Anthropic API error ${error.status}: ${error.message}` : error);
    return Response.json({ available: false, reason: 'The photo check is unavailable right now.' } satisfies PhotoVerdict);
  }
}
