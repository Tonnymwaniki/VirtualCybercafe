import Anthropic from '@anthropic-ai/sdk';

import { cleanProfile } from '@/data/profile-fields';
import { sampleWritten } from '@/lib/biz-sample';
import { isWrittenKind, type TenderSearch, type WriteBrief, type WriteResult } from '@/lib/biz-types';
import { findTenders, writeDoc } from '@/server/biz-agent';
import { withUsage } from '@/server/usage';

function str(value: unknown, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function sampleTenders(query: string): TenderSearch {
  return {
    tenders: [
      {
        title: `Sample tender: supply of ${query || 'general items'}`,
        entity: 'Sample County Government',
        reference: 'SAMPLE/001/2026',
        closingDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
        closingText: '',
        group: 'youth',
        documents: ['Business registration certificate', 'KRA PIN certificate', 'Tax compliance certificate', 'AGPO certificate'],
        howToApply: 'Download the tender document from tenders.go.ke and submit it before the closing date.',
        url: 'https://tenders.go.ke',
        whyItFits: 'This is an example so you can try the tender tracker.',
        scamSignals: [],
      },
    ],
    note: 'Turn on the AI to search real tenders on tenders.go.ke.',
    mode: 'sample',
  };
}

export function POST(request: Request) {
  return withUsage(request, 'business', () => handle(request));
}

async function handle(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const profile = body.profile && typeof body.profile === 'object' ? cleanProfile(body.profile as Record<string, unknown>) : {};

  try {
    if (body.action === 'write') {
      const kind = str(body.kind, 20);
      if (!isWrittenKind(kind)) return Response.json({ error: 'Unknown document kind' }, { status: 400 });
      const b = (body.brief ?? {}) as Record<string, unknown>;
      const brief: WriteBrief = { topic: str(b.topic, 600), extra: str(b.extra, 600), details: str(b.details, 3000) };
      if (!hasKey) return Response.json({ content: sampleWritten(kind, brief, profile), problem: '', mode: 'sample' } satisfies WriteResult);
      const content = await writeDoc(kind, brief, profile);
      return Response.json({
        content,
        problem: content ? '' : 'I couldn’t write that one. Try describing it differently.',
        mode: 'ai',
      } satisfies WriteResult);
    }

    if (body.action === 'tenders') {
      const query = str(body.query, 200);
      if (!query) return Response.json({ error: 'Say what the business does' }, { status: 400 });
      const county = str(body.county, 60);
      const agpo = str(body.agpoCategory, 40);
      return Response.json(hasKey ? await findTenders(query, county, agpo) : sampleTenders(query));
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error(error);
    }
    return Response.json({ error: 'The business helper is unavailable right now' }, { status: 502 });
  }
}
