// Checks the keys in .env: run with `npm run check-keys`.
import Anthropic from '@anthropic-ai/sdk';

let ok = true;

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('✗ ANTHROPIC_API_KEY is empty: the attendant and CV writer use sample text.');
  ok = false;
} else {
  try {
    const modelId = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
    const client = new Anthropic();
    const model = await client.models.retrieve(modelId);
    // A tiny real request (a fraction of a US cent) confirms there is credit.
    await client.messages.create({ model: modelId, max_tokens: 5, messages: [{ role: 'user', content: 'Hi' }] });
    console.log(`✓ Anthropic key works with ${model.display_name}. The AI attendant is on.`);
  } catch (error) {
    ok = false;
    if (error instanceof Anthropic.BadRequestError && /credit/i.test(error.message)) console.log('✗ Anthropic key works but has no credit. Add credit under Billing in the console.');
    else if (error instanceof Anthropic.NotFoundError) console.log('✗ The model in ANTHROPIC_MODEL was not found. Remove that line to use Claude Haiku 4.5.');
    else if (error instanceof Anthropic.AuthenticationError) console.log('✗ Anthropic key was rejected. Copy it again from console.anthropic.com.');
    else if (error instanceof Anthropic.PermissionDeniedError) console.log('✗ Anthropic key has no access. Check billing/credits in the console.');
    else console.log(`✗ Could not reach Anthropic: ${error.message}`);
  }
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.log('✗ Supabase settings are empty: sign-in and the Locker run in demo mode.');
  ok = false;
} else {
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const settings = await response.json();
    console.log(`✓ Supabase reachable. Phone sign-in is ${settings.external?.phone ? 'on' : 'OFF (turn it on in Authentication > Providers)'}.`);
  } catch (error) {
    ok = false;
    console.log(`✗ Could not reach Supabase: ${error.message}`);
  }
}

process.exit(ok ? 0 : 1);
