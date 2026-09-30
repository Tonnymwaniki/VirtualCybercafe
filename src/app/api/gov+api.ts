import Anthropic from '@anthropic-ai/sdk';

import { findGovTask } from '@/data/gov-tasks';
import type { IdReadResult } from '@/lib/gov-types';
import { baselineRequirements, checkRequirements, readIdPhoto } from '@/server/gov-agent';
import { withUsage } from '@/server/usage';

// About 3.5 MB of image; the app shrinks photos well below this.
const MAX_IMAGE_BASE64 = 5_000_000;

export function POST(request: Request) {
  return withUsage(request, 'gov', () => handle(request));
}

async function handle(request: Request) {
  let body: { action?: string; taskId?: string; refresh?: boolean; image?: string; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  try {
    if (body.action === 'requirements') {
      const task = findGovTask(body.taskId);
      if (!task) return Response.json({ error: 'Unknown task' }, { status: 400 });
      return Response.json(hasKey ? await checkRequirements(task, !!body.refresh) : baselineRequirements(task));
    }

    if (body.action === 'read_id') {
      if (typeof body.image !== 'string' || !body.image || body.image.length > MAX_IMAGE_BASE64) {
        return Response.json({ error: 'Send one photo under 3 MB' }, { status: 400 });
      }
      if (!hasKey) {
        return Response.json({
          details: {},
          problems: ['Reading an ID photo needs the AI to be switched on. Type your details below for now.'],
          mode: 'sample',
        } satisfies IdReadResult);
      }
      const mediaType = body.mediaType === 'image/png' ? 'image/png' : 'image/jpeg';
      return Response.json(await readIdPhoto(body.image, mediaType));
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error(error);
    }
    return Response.json({ error: 'The service check is unavailable right now' }, { status: 502 });
  }
}
