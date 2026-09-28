import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

export type AppUser = {
  id: string;
  phone: string;
  fullName: string | null;
};

// In demo mode any valid number works and this is the code.
export const DEMO_CODE = '123456';
const DEMO_USER_KEY = 'demo-user';

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  demoMode: boolean;
  sendCode: (phone: string) => Promise<void>;
  verifyCode: (phone: string, code: string) => Promise<void>;
  setName: (fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function fromSupabaseUser(user: {
  id: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
}): AppUser {
  const name = user.user_metadata?.full_name;
  return {
    id: user.id,
    phone: user.phone ? `+${user.phone.replace(/^\+/, '')}` : '',
    fullName: typeof name === 'string' && name ? name : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      AsyncStorage.getItem(DEMO_USER_KEY)
        .then((stored) => stored && setUser(JSON.parse(stored)))
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? fromSupabaseUser(data.session.user) : null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? fromSupabaseUser(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const saveDemoUser = async (next: AppUser | null) => {
    setUser(next);
    if (next) await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(DEMO_USER_KEY);
  };

  const value: AuthContextValue = {
    user,
    loading,
    demoMode: !supabase,
    async sendCode(phone) {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
    },
    async verifyCode(phone, code) {
      if (!supabase) {
        if (code !== DEMO_CODE) throw new Error('That code is not right. In demo mode it is 123456.');
        await saveDemoUser({ id: `demo-${phone}`, phone, fullName: null });
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (error) throw error;
    },
    async setName(fullName) {
      if (!user) return;
      if (!supabase) {
        await saveDemoUser({ ...user, fullName });
        return;
      }
      const { data, error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (error) throw error;
      setUser(fromSupabaseUser(data.user));
    },
    async signOut() {
      if (!supabase) {
        await saveDemoUser(null);
        return;
      }
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
