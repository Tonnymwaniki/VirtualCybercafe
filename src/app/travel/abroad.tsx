import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, LinkButton, Note, openUrl } from '@/components/gov/ui';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { checkAgency } from '@/lib/travel-client';
import { abroadScamSignals } from '@/lib/travel-sample';
import type { AgencyCheck, AgencyStatus } from '@/lib/travel-types';

const statusText: Record<AgencyStatus, { text: string; tone: 'good' | 'warn' | 'info' }> = {
  listed: { text: 'On the official list of accredited agencies', tone: 'good' },
  not_listed: { text: 'Not found on the official list', tone: 'warn' },
  revoked: { text: 'Suspended, deregistered or on a warning list', tone: 'warn' },
  unclear: { text: 'Couldn’t confirm', tone: 'info' },
};

const safeSteps = [
  'Use only an agency on the National Employment Authority (NEA) list.',
  'Get the job contract in writing and read it before you pay anything or travel.',
  'You need a work visa or work permit. Never travel for a job on a tourist or visitor visa.',
  'Keep your passport with you. An employer or agent should not hold it.',
  'Pay only to the agency’s company account and get an official receipt.',
  'Give your family the employer’s name, address and phone, and keep copies of your documents in your Locker.',
];

// Work abroad safety: check a recruitment agency on the official list and a
// job offer for common scam signs.
export default function AbroadScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [result, setResult] = useState<AgencyCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState('');
  const [offer, setOffer] = useState('');
  const [signals, setSignals] = useState<string[] | null>(null);

  const check = async () => {
    setChecking(true);
    setProblem('');
    const found = await checkAgency(name.trim());
    setChecking(false);
    if (!found) setProblem('Couldn’t check right now. Check your connection, or search the agency on nea.go.ke.');
    setResult(found);
  };

  return (
    <Screen>
      <SubHeader title="Working abroad" />
      <Text style={styles.intro}>
        Many Kenyans lose money to fake overseas job agents. Check the agent and the offer before you pay anything.
      </Text>

      <Card title="1. Check the recruitment agency">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Agency name, e.g. ABC Recruitment Ltd"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />
        <View style={styles.row}>
          <Button label="Check the official list" icon="search" onPress={check} busy={checking} disabled={!name.trim()} />
        </View>
        {!!problem && <Note tone="warn">{problem}</Note>}
        {result && (
          <>
            <Note tone={statusText[result.status].tone}>
              {result.name}: {statusText[result.status].text}.
            </Note>
            <Text style={styles.body}>{result.detail}</Text>
            {result.sources.map((source) => (
              <LinkButton key={source.url} label={source.title || 'Official list'} onPress={() => openUrl(source.url)} />
            ))}
          </>
        )}
      </Card>

      <Card title="2. Check the job offer">
        <TextInput
          value={offer}
          onChangeText={(text) => {
            setOffer(text);
            setSignals(null);
          }}
          placeholder="Paste the job advert, message or WhatsApp text here"
          placeholderTextColor={Colors.textMuted}
          multiline
          style={[styles.input, styles.multiline]}
        />
        <View style={styles.row}>
          <Button
            label="Check for scam signs"
            icon="shield-checkmark"
            onPress={() => setSignals(abroadScamSignals(offer))}
            disabled={!offer.trim()}
          />
        </View>
        {signals?.length === 0 && (
          <Note tone="good">I didn’t spot common scam signs. Still check the agency on the official list before paying.</Note>
        )}
        {signals?.map((signal) => (
          <Note key={signal} tone="warn">
            {signal}
          </Note>
        ))}
      </Card>

      <Card title="Travel for work safely">
        {safeSteps.map((step) => (
          <Text key={step} style={styles.body}>
            • {step}
          </Text>
        ))}
        <LinkButton
          label="Get a Certificate of Good Conduct"
          icon="arrow-forward-circle"
          onPress={() => router.push('/gov/good_conduct' as Href)}
        />
        <LinkButton label="Open the NEA website" onPress={() => openUrl('https://www.nea.go.ke')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted, lineHeight: 21 },
  body: { fontSize: 14, color: Colors.text, lineHeight: 21 },
  row: { flexDirection: 'row', gap: Spacing.md },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
});
