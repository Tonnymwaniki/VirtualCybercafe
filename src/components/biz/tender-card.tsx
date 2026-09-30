import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LinkButton, Note, openUrl } from '@/components/gov/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { eligibility } from '@/lib/biz-tenders';
import type { Tender } from '@/lib/biz-types';
import { deadlineLabel, daysLeft } from '@/lib/jobs-store';

// One tender: who, closing date, AGPO eligibility and scam warnings.
export function TenderCard({ tender, agpoCategory, children }: { tender: Tender; agpoCategory: string; children?: ReactNode }) {
  const router = useRouter();
  const fit = eligibility(tender, agpoCategory);
  const days = daysLeft(tender.closingDate);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{tender.title}</Text>
      <Text style={styles.muted}>
        {tender.entity}
        {tender.reference ? ` · ${tender.reference}` : ''}
      </Text>
      <Text style={[styles.deadline, days !== null && days <= 3 && styles.urgent]}>
        {tender.closingDate ? deadlineLabel(tender.closingDate) : tender.closingText || 'Closing date not given'}
      </Text>
      {tender.scamSignals.length > 0 && (
        <Note tone="warn">
          Be careful: {tender.scamSignals.join(' ')}
        </Note>
      )}
      <Note tone={fit.tone}>{fit.text}</Note>
      {fit.needsAgpo && (
        <LinkButton label="Get an AGPO certificate" icon="arrow-forward-circle" onPress={() => router.push('/gov/agpo' as Href)} />
      )}
      {!!tender.whyItFits && <Text style={styles.item}>{tender.whyItFits}</Text>}
      <LinkButton label="Open the official tender page" onPress={() => openUrl(tender.url)} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: 6,
  },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted },
  item: { fontSize: 14, color: Colors.text },
  deadline: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  urgent: { color: '#B91C1C' },
});
