import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SignInNotice } from '@/components/sign-in-notice';
import { EngineProvider } from '@/components/workbench/engine';
import { AuthProvider } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AuthProvider>
        {/* The Workbench's hidden page reader, shared by its tools and the chat. */}
        <EngineProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </EngineProvider>
        <SignInNotice />
        <StatusBar style="dark" />
      </AuthProvider>
    </LanguageProvider>
  );
}
