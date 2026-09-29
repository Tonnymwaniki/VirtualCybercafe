import Anthropic from '@anthropic-ai/sdk';

import { sampleCourses, sampleDemand, sampleLetter } from '@/lib/edu-sample';
import type { CourseQuery, ReadLetterResult } from '@/lib/edu-types';
import { levels, type Level } from '@/lib/kcse';
import { courseDemand, readLetter, suggestCourses } from '@/server/edu-agent';

const MAX_IMAGE_BASE64 = 5_000_000;

function str(value: unknown, max: number) {
  return typeof value === 'string' ? value.slice(0, max).trim() : '';
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  try {
    if (body.action === 'courses') {
      const query: CourseQuery = {
        grades: str(body.grades, 600),
        meanGrade: str(body.meanGrade, 3),
        interests: str(body.interests, 300),
        level: levels.find((l) => l === body.level) ?? ('Degree' as Level),
        county: str(body.county, 60),
      };
      return Response.json(hasKey ? await suggestCourses(query) : sampleCourses(query));
    }

    if (body.action === 'demand') {
      const programmes = (Array.isArray(body.programmes) ? body.programmes : [])
        .filter((p): p is string => typeof p === 'string' && !!p.trim())
        .map((p) => p.trim().slice(0, 160))
        .slice(0, 6);
      if (!programmes.length) return Response.json({ error: 'Name at least one course' }, { status: 400 });
      return Response.json(hasKey ? await courseDemand(programmes, str(body.meanGrade, 3)) : sampleDemand());
    }

    if (body.action === 'read_letter') {
      const text = str(body.text, 20000);
      const image = typeof body.image === 'string' ? body.image : '';
      if (image.length > MAX_IMAGE_BASE64) return Response.json({ error: 'Send one photo under 3 MB' }, { status: 400 });
      if (!text && !image) return Response.json({ error: 'Nothing to read' }, { status: 400 });
      if (!hasKey) {
        if (text) return Response.json({ letter: sampleLetter(text), problem: '', mode: 'sample' } satisfies ReadLetterResult);
        return Response.json({
          letter: null,
          problem: 'Reading a photo needs the AI to be switched on. Paste the letter text for now.',
          mode: 'sample',
        } satisfies ReadLetterResult);
      }
      return Response.json(await readLetter({ text: text || undefined, image: image || undefined }));
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error(error);
    }
    return Response.json({ error: 'The education helper is unavailable right now' }, { status: 502 });
  }
}
