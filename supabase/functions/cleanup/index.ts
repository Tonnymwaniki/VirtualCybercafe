// Scheduled clean-up, run every hour by Supabase Cron (see README):
// deletes print-at-any-cyber files and codes once they are printed or
// expired, even if the owner never opens the app again.
//
// Storage files can only be deleted through the Storage API, so this runs as
// an Edge Function with the service role key that Supabase gives every
// function. The key never leaves Supabase and is not in the app.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

// A printed code is kept an hour so the cyber can still see "printed".
const PRINTED_GRACE_MS = 60 * 60 * 1000;
const BATCH = 200;

Deno.serve(async () => {
  const now = new Date();
  const printedBefore = new Date(now.getTime() - PRINTED_GRACE_MS).toISOString();
  let removed = 0;

  for (let round = 0; round < 10; round++) {
    const { data, error } = await supabase
      .from('quick_prints')
      .select('id, file_path')
      .or(`expires_at.lt.${now.toISOString()},printed_at.lt.${printedBefore}`)
      .limit(BATCH);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;

    const { error: storageError } = await supabase.storage.from('quickprint').remove(data.map((row) => row.file_path));
    if (storageError) return Response.json({ error: storageError.message, removed }, { status: 500 });
    const { error: deleteError } = await supabase.from('quick_prints').delete().in('id', data.map((row) => row.id));
    if (deleteError) return Response.json({ error: deleteError.message, removed }, { status: 500 });

    removed += data.length;
    if (data.length < BATCH) break;
  }

  // Failed-lookup records only matter for an hour.
  await supabase.from('quick_print_misses').delete().lt('at', new Date(now.getTime() - 60 * 60 * 1000).toISOString());

  return Response.json({ removed });
});
