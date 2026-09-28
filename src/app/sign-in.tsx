import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPhone, toKenyanE164 } from '@/lib/phone';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const CODE_LENGTH = 6;

export default function SignInScreen() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const e164 = toKenyanE164(phoneInput);
    if (!e164) {
      setError('Enter a valid Kenyan mobile number, e.g. 0712 345 678.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setPhone(e164);
    setCode('');
    setStep('code');
  };

  // On success the auth listener picks up the session and the router leaves this screen.
  const verifyCode = async () => {
    if (code.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code.`);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    setBusy(false);
    if (verifyError) setError(verifyError.message);
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="desktop" size={28} color={Colors.onDark} />
        </View>
        <Text style={styles.title}>Virtual Cybercafe</Text>
        <Text style={styles.subtitle}>
          {step === 'phone'
            ? 'Sign in with your phone number. We’ll text you a code.'
            : `Enter the ${CODE_LENGTH}-digit code sent to ${formatPhone(phone)}.`}
        </Text>
      </View>

      {!isSupabaseConfigured && (
        <View style={styles.warning}>
          <Ionicons name="warning" size={16} color={Colors.text} />
          <Text style={styles.warningText}>
            Supabase isn’t configured. Add EXPO_PUBLIC_SUPABASE_URL and
            EXPO_PUBLIC_SUPABASE_ANON_KEY to .env and restart the dev server.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        {step === 'phone' ? (
          <>
            <Text style={styles.label}>Phone number</Text>
            <View style={styles.inputRow}>
              <Text style={styles.prefix}>🇰🇪 +254</Text>
              <TextInput
                value={phoneInput}
                onChangeText={setPhoneInput}
                onSubmitEditing={sendCode}
                placeholder="712 345 678"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                style={styles.input}
                editable={!busy}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Verification code</Text>
            <TextInput
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              onSubmitEditing={verifyCode}
              placeholder="123456"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={CODE_LENGTH}
              style={[styles.inputRow, styles.input, styles.codeInput]}
              editable={!busy}
              autoFocus
            />
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={step === 'phone' ? sendCode : verifyCode}
          disabled={busy || !isSupabaseConfigured}
          style={({ pressed }) => [
            styles.button,
            (busy || !isSupabaseConfigured) && styles.disabled,
            pressed && styles.pressed,
          ]}>
          {busy ? (
            <ActivityIndicator color={Colors.onDark} />
          ) : (
            <Text style={styles.buttonText}>{step === 'phone' ? 'Send code' : 'Verify & sign in'}</Text>
          )}
        </Pressable>

        {step === 'code' && (
          <View style={styles.links}>
            <Pressable onPress={() => { setStep('phone'); setError(null); }} disabled={busy}>
              <Text style={styles.link}>Change number</Text>
            </Pressable>
            <Pressable onPress={sendCode} disabled={busy}>
              <Text style={styles.link}>Resend code</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xl * 2 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 15, color: Colors.textMuted, textAlign: 'center' },
  warning: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: '#FEF3C7',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  warningText: { flex: 1, fontSize: 13, color: Colors.text },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  prefix: { fontSize: 16, color: Colors.text },
  input: { flex: 1, fontSize: 16, color: Colors.text, paddingVertical: Spacing.md },
  codeInput: { flex: 0, fontSize: 22, letterSpacing: 8, textAlign: 'center' },
  error: { fontSize: 13, color: '#DC2626' },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: Colors.onDark },
  disabled: { opacity: 0.5 },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  pressed: { opacity: 0.7 },
});
