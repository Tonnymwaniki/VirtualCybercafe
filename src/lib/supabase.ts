import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// The web build is also rendered on the dev server, where there is no
// browser storage; keep sessions only in a real browser or on the phone.
const hasStorage = Platform.OS !== 'web' || typeof window !== 'undefined';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Null until the Supabase project is configured in .env; the app then runs
// sign-in and the Locker in demo mode.
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: hasStorage ? AsyncStorage : undefined,
          autoRefreshToken: hasStorage,
          persistSession: hasStorage,
          detectSessionInUrl: Platform.OS === 'web' && hasStorage,
        },
      })
    : null;

export const LOCKER_BUCKET = 'locker';
