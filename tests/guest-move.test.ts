import AsyncStorage from '@react-native-async-storage/async-storage';

import { findGuestWork, moveGuestWork } from '@/lib/guest-move';
import { loadJobs } from '@/lib/jobs-store';
import { loadProfile } from '@/lib/profile-store';
import { loadRecords } from '@/lib/record-store';

const account = 'demo-+254700000001';
const now = '2026-09-29T10:00:00.000Z';

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('gov:guest:id', JSON.stringify({ fullName: 'Jane Wanjiku', email: 'guest@example.com' }));
  await AsyncStorage.setItem('jobs:guest', JSON.stringify({ j1: { id: 'j1', advert: { title: 'Clerk' }, status: 0, createdAt: now, updatedAt: now } }));
  await AsyncStorage.setItem('records:guest:chat:', JSON.stringify({ c1: { id: 'c1', messages: [], updatedAt: now } }));
});

describe('guest work at sign-in', () => {
  it('counts what a guest left on the phone', async () => {
    expect(await findGuestWork()).toEqual({ details: 2, jobs: 1, chats: 1, other: 0, fullName: 'Jane Wanjiku' });
  });

  it('moves it into the account without overwriting account details', async () => {
    await AsyncStorage.setItem(`gov:${account}:id`, JSON.stringify({ email: 'mine@example.com' }));
    await moveGuestWork(account);
    expect(await loadProfile(account)).toEqual({ fullName: 'Jane Wanjiku', email: 'mine@example.com' });
    expect((await loadJobs(account)).map((j) => j.id)).toEqual(['j1']);
    expect(Object.keys(await loadRecords(account, 'chat:'))).toEqual(['c1']);
    expect(await findGuestWork()).toBeNull();
  });
});
