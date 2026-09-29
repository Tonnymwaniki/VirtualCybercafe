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
import { useLanguage, type Translate } from '@/lib/i18n';
import { normaliseKenyanPhone } from '@/lib/phone';

type Stage = 'phone' | 'code' | 'move' | 'name';

export default function SignInScreen() {
  const router = useRouter();
  const { sendCode, verifyCode, setName, demoMode } = useAuth();
  const { t } = useLanguage();
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
      setError(e instanceof Error ? e.message : t('signin.error'));
    } finally {
      setBusy(false);
    }
  };

  const submitPhone = () =>
    run(async () => {
      const normalised = normaliseKenyanPhone(phoneInput);
      if (!normalised) throw new Error(t('signin.badPhone'));
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
      <SubHeader title={t('common.signIn')} help={false} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark" size={28} color={Colors.onDark} />
        </View>
        <Text style={styles.heroText}>{t('signin.hero')}</Text>
      </View>

      {demoMode && (
        <View style={styles.demo}>
          <Ionicons name="information-circle" size={18} color={Colors.primary} />
          <Text style={styles.demoText}>{t('signin.demo', { code: DEMO_CODE })}</Text>
        </View>
      )}

      {stage === 'phone' && (
        <>
          <Text style={styles.label}>{t('signin.phoneLabel')}</Text>
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
            <Button label={t('signin.sendCode')} icon="chatbox-ellipses" onPress={submitPhone} busy={busy} />
          </View>
        </>
      )}

      {stage === 'code' && (
        <>
          <Text style={styles.label}>{t('signin.codeLabel', { phone })}</Text>
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
            <Button label={t('signin.changeNumber')} variant="secondary" onPress={() => setStage('phone')} />
            <Button label={t('signin.verify')} onPress={submitCode} busy={busy} disabled={code.trim().length < 6} />
          </View>
        </>
      )}

      {stage === 'move' && work && (
        <View style={styles.move}>
          <Text style={styles.label}>{t('signin.keepQuestion')}</Text>
          <Text style={styles.moveText}>{t('signin.phoneHas')}</Text>
          {guestLines(t, work).map((line) => (
            <View key={line} style={styles.moveLine}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
              <Text style={styles.moveText}>{line}</Text>
            </View>
          ))}
          <Text style={styles.moveNote}>{t('signin.moveNote')}</Text>
          <View style={styles.row}>
            <Button label={t('signin.leave')} variant="secondary" onPress={() => setStage('name')} />
            <Button label={t('signin.keep')} icon="cloud-upload" onPress={keepWork} busy={busy} />
          </View>
        </View>
      )}

      {stage === 'name' && (
        <>
          <Text style={styles.label}>{t('signin.nameQuestion')}</Text>
          <TextInput
            value={name}
            onChangeText={setNameInput}
            placeholder={t('signin.namePlaceholder')}
            placeholderTextColor={Colors.textMuted}
            autoComplete="name"
            style={styles.input}
            onSubmitEditing={submitName}
          />
          <View style={styles.row}>
            <Button label={t('signin.continue')} onPress={submitName} busy={busy} />
          </View>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </Screen>
  );
}

function guestLines(t: Translate, work: GuestWork) {
  return [
    work.details ? (work.details === 1 ? t('signin.detailsOne') : t('signin.details', { n: work.details })) : '',
    work.jobs ? (work.jobs === 1 ? t('signin.jobOne') : t('signin.jobs', { n: work.jobs })) : '',
    work.chats ? (work.chats === 1 ? t('signin.chatOne') : t('signin.chats', { n: work.chats })) : '',
    work.other ? (work.other === 1 ? t('signin.otherOne') : t('signin.others', { n: work.other })) : '',
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
