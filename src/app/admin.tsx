import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { flush, localStats } from '@/lib/stats';
import { supabase } from '@/lib/supabase';

type Row = { day: string; name: string; count: number };
type ErrorRow = { at: string; place: string; message: string; platform: string; version: string };
type State =
  | { step: 'loading' }
  | { step: 'denied'; text: string }
  | { step: 'ready'; rows: Row[]; errors: ErrorRow[]; demo: boolean };

const RANGES = [1, 7, 30];

// Groups: what people start and finish, which tools they use, and errors.
const groups: { title: string; prefix: string }[] = [
  { title: 'Accounts and welcome', prefix: 'account.|onboarding.' },
  { title: 'AI helper calls', prefix: 'ai.' },
  { title: 'Document Workbench', prefix: 'workbench.' },
  { title: 'Files in the chat', prefix: 'chat.' },
  { title: 'Jobs', prefix: 'jobs.' },
  { title: 'Print at any cyber', prefix: 'print.' },
  { title: 'Locker', prefix: 'locker.' },
  { title: 'Screens opened', prefix: 'screen.' },
  { title: 'Other', prefix: '' },
];

// The app's admin page (/admin): step counts and error reports, for people
// listed in app_admins (supabase/migrations/0006_stats_errors.sql). No
// personal details are stored, so none are shown.
export default function AdminScreen() {
  const { user } = useAuth();
  const [days, setDays] = useState(7);
  const [state, setState] = useState<State>({ step: 'loading' });

  const load = useCallback(async () => {
    setState({ step: 'loading' });
    await flush();
    if (!supabase) {
      const since = new Date(Date.now() + 3 * 3600_000 - days * 86_400_000).toISOString().slice(0, 10);
      setState({ step: 'ready', rows: (await localStats()).filter((r) => r.day > since), errors: [], demo: true });
      return;
    }
    if (!user) return setState({ step: 'denied', text: 'Sign in with an admin account to see this page.' });
    const [stats, errors] = await Promise.all([
      supabase.rpc('admin_stats', { p_days: days }),
      supabase.rpc('admin_errors', { p_limit: 50 }),
    ]);
    if (stats.error || errors.error) {
      const message = (stats.error ?? errors.error)!.message;
      return setState({
        step: 'denied',
        text: /admins only/i.test(message)
          ? 'This page is for the app’s admins. Add your account to app_admins in Supabase (see 0006_stats_errors.sql).'
          : 'Couldn’t load the stats. Run supabase/migrations/0006_stats_errors.sql, then try again.',
      });
    }
    setState({ step: 'ready', rows: (stats.data ?? []) as Row[], errors: (errors.data ?? []) as ErrorRow[], demo: false });
  }, [days, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen>
      <SubHeader title="Admin" help={false} />
      <View style={styles.ranges}>
        {RANGES.map((range) => (
          <Pressable key={range} onPress={() => setDays(range)} style={[styles.range, range === days && styles.rangeActive]}>
            <Text style={[styles.rangeText, range === days && styles.rangeTextActive]}>{range === 1 ? 'Today' : `${range} days`}</Text>
          </Pressable>
        ))}
      </View>

      {state.step === 'loading' && <ActivityIndicator color={Colors.primary} />}
      {state.step === 'denied' && <Text style={styles.muted}>{state.text}</Text>}
      {state.step === 'ready' && (
        <>
          {state.demo && <Text style={styles.muted}>Demo mode: counts from this device only.</Text>}
          <Totals rows={state.rows} />
          {state.errors.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent errors</Text>
              {state.errors.map((error, i) => (
                <View key={`${error.at}-${i}`} style={styles.error}>
                  <Text style={styles.errorPlace}>
                    {new Date(error.at).toLocaleString('en-GB')} · {error.place} · {error.platform} {error.version}
                  </Text>
                  <Text style={styles.errorText}>{error.message}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.muted}>AI costs per feature: open /api/usage?days=7&key=… with the server’s USAGE_KEY.</Text>
        </>
      )}
    </Screen>
  );
}

function Totals({ rows }: { rows: Row[] }) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.name, (totals.get(row.name) ?? 0) + row.count);
  if (!totals.size) return <Text style={styles.muted}>Nothing counted in this period yet.</Text>;
  const used = new Set<string>();
  return (
    <>
      {groups.map((group) => {
        const names = [...totals.keys()]
          .filter((name) => !used.has(name) && (!group.prefix || group.prefix.split('|').some((p) => name.startsWith(p))))
          .sort((a, b) => totals.get(b)! - totals.get(a)!);
        names.forEach((name) => used.add(name));
        if (!names.length) return null;
        return (
          <View key={group.title} style={styles.card}>
            <Text style={styles.cardTitle}>{group.title}</Text>
            {names.map((name) => (
              <View key={name} style={styles.row}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.count}>{totals.get(name)}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  ranges: { flexDirection: 'row', gap: Spacing.sm },
  range: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  rangeActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rangeText: { fontSize: 13, color: Colors.text },
  rangeTextActive: { color: Colors.onDark, fontWeight: '600' },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  name: { flex: 1, fontSize: 13, color: Colors.text, fontFamily: 'monospace' },
  count: { fontSize: 13, fontWeight: '700', color: Colors.text },
  error: { gap: 2, paddingVertical: 4, borderTopWidth: 1, borderTopColor: Colors.border },
  errorPlace: { fontSize: 12, color: Colors.textMuted },
  errorText: { fontSize: 13, color: '#DC2626' },
});
