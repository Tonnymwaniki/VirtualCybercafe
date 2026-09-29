import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { DEMO_CODE, useAuth } from '@/lib/auth';
import { findGuestWork, moveGuestWork, type GuestWork } from '@/lib/guest-move';
import { normaliseKenyanPhone } from '@/lib/phone';

type Stage = 'phone' | 'code' | 'move' | 'name';

export default function SignInScreen() {
  const router = useRouter();
  const { sendCode, verifyCode, setName, demoMode } = useAuth();
  const [stage, setStage] = useState<Stage>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [work, setWork] = useState<GuestWork | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitPhone = () =>
    run(async () => {
      const normalised = normaliseKenyanPhone(phoneInput);
      if (!normalised) throw new Error('Enter a Kenyan phone number, like 0712 345 678.');
      await sendCode(normalised);
      setPhone(normalised);
      setStage('code');
    });

  const submitCode = () =>
    run(async () => {
      const id = await verifyCode(phone, code.trim());
      setUserId(id);
      // Work done before signing in: offer to bring it into the account.
      const found = await findGuestWork().catch(() => null);
      if (found?.fullName) setNameInput(found.fullName);
      setWork(found);
      setStage(found ? 'move' : 'name');
    });

  const keepWork = () =>
    run(async () => {
      await moveGuestWork(userId);
      setStage('name');
    });

  const submitName = () =>
    run(async () => {
      if (name.trim()) await setName(name.trim());
      router.canGoBack() ? router.back() : router.replace('/');
    });

  return (
    <Screen>
      <SubHeader title="Sign in" help={false} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark" size={28} color={Colors.onDark} />
        </View>
        <Text style={styles.heroText}>
          Sign in with your phone number to keep your documents safe in your Digital Locker.
        </Text>
      </View>

      {demoMode && (
        <View style={styles.demo}>
          <Ionicons name="information-circle" size={18} color={Colors.primary} />
          <Text style={styles.demoText}>
            Demo mode: no SMS is sent. Use code {DEMO_CODE}. Files stay on this device until sign-in is
            connected.
          </Text>
        </View>
      )}

      {stage === 'phone' && (
        <>
          <Text style={styles.label}>Phone number</Text>
          <TextInput
            value={phoneInput}
            onChangeText={setPhoneInput}
            placeholder="0712 345 678"
            placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad"
            autoComplete="tel"
            style={styles.input}
            onSubmitEditing={submitPhone}
          />
          <View style={styles.row}>
            <Button label="Send code" icon="chatbox-ellipses" onPress={submitPhone} busy={busy} />
          </View>
        </>
      )}

      {stage === 'code' && (
        <>
          <Text style={styles.label}>Enter the 6-digit code sent to {phone}</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            maxLength={6}
            style={[styles.input, styles.codeInput]}
            onSubmitEditing={submitCode}
          />
          <View style={styles.row}>
            <Button label="Change number" variant="secondary" onPress={() => setStage('phone')} />
            <Button label="Verify" onPress={submitCode} busy={busy} disabled={code.trim().length < 6} />
          </View>
        </>
      )}

      {stage === 'move' && work && (
        <View style={styles.move}>
          <Text style={styles.label}>Keep what you did before signing in?</Text>
          <Text style={styles.moveText}>This phone has:</Text>
          {guestLines(work).map((line) => (
            <View key={line} style={styles.moveLine}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
              <Text style={styles.moveText}>{line}</Text>
            </View>
          ))}
          <Text style={styles.moveNote}>
            It will be saved on your account, so you can see it on any phone. Details already on your account stay as
            they are.
          </Text>
          <View style={styles.row}>
            <Button label="Leave on phone" variant="secondary" onPress={() => setStage('name')} />
            <Button label="Keep them" icon="cloud-upload" onPress={keepWork} busy={busy} />
          </View>
        </View>
      )}

      {stage === 'name' && (
        <>
          <Text style={styles.label}>You’re in! What should we call you?</Text>
          <TextInput
            value={name}
            onChangeText={setNameInput}
            placeholder="Your full name"
            placeholderTextColor={Colors.textMuted}
            autoComplete="name"
            style={styles.input}
            onSubmitEditing={submitName}
          />
          <View style={styles.row}>
            <Button label="Continue" onPress={submitName} busy={busy} />
          </View>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </Screen>
  );
}

function guestLines(work: GuestWork) {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    work.details ? `Your details (${plural(work.details, 'item', 'items')})` : '',
    work.jobs ? plural(work.jobs, 'job', 'jobs') : '',
    work.chats ? plural(work.chats, 'chat', 'chats') : '',
    work.other ? plural(work.other, 'other saved item', 'other saved items') : '',
  ].filter(Boolean);
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { fontSize: 16, color: Colors.onDark, lineHeight: 22 },
  demo: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  demoText: { flex: 1, fontSize: 13, color: Colors.text },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 17,
    color: Colors.text,
  },
  codeInput: { letterSpacing: 8, textAlign: 'center', fontSize: 22 },
  row: { flexDirection: 'row', gap: Spacing.md },
  move: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  moveLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  moveText: { fontSize: 15, color: Colors.text },
  moveNote: { fontSize: 13, color: Colors.textMuted, marginVertical: Spacing.xs },
  error: { color: '#DC2626', fontSize: 14 },
});
