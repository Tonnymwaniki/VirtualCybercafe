// Supabase "Send SMS" auth hook: sends sign-in codes through Africa's Talking
// instead of Twilio. Deploy with the Supabase CLI (see README).
//
// Secrets (supabase secrets set ...):
//   SEND_SMS_HOOK_SECRET  the hook secret Supabase shows, e.g. "v1,whsec_..."
//   AT_USERNAME           Africa's Talking app username ("sandbox" for testing)
//   AT_API_KEY            Africa's Talking API key
//   AT_SENDER_ID          optional registered sender ID / short code

import { Webhook } from 'npm:standardwebhooks@1.0.0';

type HookPayload = {
  user: { phone: string };
  sms: { otp: string };
};

const hookSecret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
const username = Deno.env.get('AT_USERNAME') ?? '';
const apiKey = Deno.env.get('AT_API_KEY') ?? '';
const senderId = Deno.env.get('AT_SENDER_ID');

const apiUrl =
  username === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging';

function hookError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  const body = await request.text();

  let payload: HookPayload;
  try {
    // Rejects requests that were not signed by our Supabase project.
    payload = new Webhook(hookSecret).verify(body, Object.fromEntries(request.headers)) as HookPayload;
  } catch {
    return hookError(401, 'Invalid hook signature');
  }

  const to = `+${payload.user.phone.replace(/^\+/, '')}`;
  const form = new URLSearchParams({
    username,
    to,
    message: `Your Virtual Cybercafe code is ${payload.sms.otp}. It expires in 5 minutes.`,
  });
  if (senderId) form.set('from', senderId);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  if (!response.ok) {
    console.error('Africa’s Talking error', response.status, await response.text());
    return hookError(500, 'Could not send the SMS');
  }

  const result = await response.json();
  const recipient = result?.SMSMessageData?.Recipients?.[0];
  // 100 = processed, 101 = sent, 102 = queued
  if (!recipient || ![100, 101, 102].includes(recipient.statusCode)) {
    console.error('Africa’s Talking rejected the message', JSON.stringify(result));
    return hookError(500, 'Could not send the SMS');
  }

  return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
});
