import { usageSummary } from '@/server/usage';

// What the AI features have cost, per feature, from the server's usage log.
// Totals only; no user data. Open /api/usage?days=7 in a browser. On the
// hosted app add &key=<USAGE_KEY from the server's settings>.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const key = process.env.USAGE_KEY;
  if ((key || process.env.NODE_ENV === 'production') && (!key || params.get('key') !== key)) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  const days = Math.min(Math.max(Number(params.get('days')) || 7, 1), 90);
  try {
    return Response.json(await usageSummary(days));
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
