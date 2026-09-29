import { usageSummary } from '@/server/usage';

// What the AI features have cost, per feature, from the server's usage log.
// Totals only; no user data. Open /api/usage?days=7 in a browser.
export function GET(request: Request) {
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get('days')) || 7, 1), 90);
  return Response.json(usageSummary(days));
}
