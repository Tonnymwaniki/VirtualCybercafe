import { Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OfflineNotice } from '@/components/offline-notice';
import { SignInNotice } from '@/components/sign-in-notice';
import { EngineProvider } from '@/components/workbench/engine';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';
import { eventPart, reportError, track } from '@/lib/stats';

// Counts screen visits by screen, not by person: "/jobs/abc123" counts as
// screen.jobs.id.
function useScreenStats() {
  const pathname = usePathname();
  useEffect(() => {
    const parts = pathname.split('/').filter(Boolean).slice(0, 2).map((part) => (/\d/.test(part) ? 'id' : eventPart(part)));
    track(['screen', ...(parts.length ? parts : ['home'])].join('.'));
  }, [pathname]);
}

export default function RootLayout() {
  useScreenStats();
  return (
    <LanguageProvider>
      <AuthProvider>
        {/* The Workbench's hidden page reader, shared by its tools and the chat. */}
        <EngineProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </EngineProvider>
        <SignInNotice />
        <OfflineNotice />
        <StatusBar style="dark" />
      </AuthProvider>
    </LanguageProvider>
  );
}

// When a screen crashes: a friendly page with Try again, and a report of
// what broke (no personal details) for the admin page.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const pathname = usePathname();
  useEffect(() => {
    reportError(`screen${pathname}`.replace(/\/[^/]*\d[^/]*/g, '/id'), error);
  }, [error, pathname]);
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.text}>Sorry, this screen stopped working. We’ve been told about it. Your saved work is safe.</Text>
      <Text style={styles.text}>Samahani, skrini hii imekwama. Kazi yako iliyohifadhiwa iko salama.</Text>
      <Pressable onPress={retry} style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
        <Text style={styles.buttonText}>Try again · Jaribu tena</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl, backgroundColor: Colors.background },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  text: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 21, maxWidth: 420 },
  button: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: 12, marginTop: Spacing.sm },
  buttonText: { color: Colors.onDark, fontSize: 15, fontWeight: '700' },
});
