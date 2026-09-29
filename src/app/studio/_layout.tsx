import { Stack } from 'expo-router';

import { EngineProvider } from '@/components/workbench/engine';

// The Document Workbench: its screens share the hidden page reader.
export default function Layout() {
  return (
    <EngineProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </EngineProvider>
  );
}
