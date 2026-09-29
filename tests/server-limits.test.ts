/**
 * @jest-environment node
 */
import { signInRequired } from '@/server/caller';
import { estimateCost } from '@/server/usage';

describe('AI sign-in rule', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('is off on the dev server and on in production with Supabase', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    delete process.env.AI_REQUIRE_SIGN_IN;
    (process.env as Record<string, string>).NODE_ENV = 'development';
    expect(signInRequired()).toBe(false);
    (process.env as Record<string, string>).NODE_ENV = 'production';
    expect(signInRequired()).toBe(true);
  });

  it('follows AI_REQUIRE_SIGN_IN when set', () => {
    process.env.AI_REQUIRE_SIGN_IN = '1';
    expect(signInRequired()).toBe(true);
    process.env.AI_REQUIRE_SIGN_IN = '0';
    (process.env as Record<string, string>).NODE_ENV = 'production';
    expect(signInRequired()).toBe(false);
  });
});

describe('cost estimate', () => {
  it('prices Haiku tokens and web searches', () => {
    const cost = estimateCost('claude-haiku-4-5', { input: 1_000_000, output: 100_000, cacheRead: 0, cacheWrite: 0, searches: 2 });
    expect(cost).toBeCloseTo(1 + 0.5 + 0.02, 5);
  });
});
