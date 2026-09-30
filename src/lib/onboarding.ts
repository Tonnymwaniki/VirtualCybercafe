import AsyncStorage from '@react-native-async-storage/async-storage';

import { track } from '@/lib/stats';

// The three welcome screens show once, on the first open of Home.
const ONBOARDED_KEY = 'vc-onboarded';
// The Home hero's first-visit tips; the welcome screens cover them.
const WELCOME_SEEN_KEY = 'vc-welcome-seen';

export async function needsOnboarding() {
  try {
    return !(await AsyncStorage.getItem(ONBOARDED_KEY));
  } catch {
    return false;
  }
}

export async function finishOnboarding() {
  track('onboarding.done');
  try {
    await AsyncStorage.multiSet([
      [ONBOARDED_KEY, '1'],
      [WELCOME_SEEN_KEY, '1'],
    ]);
  } catch {
    // Storage unavailable: the welcome may show again next time.
  }
}
