import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CheckRow, LinkButton, Note } from '@/components/gov/ui';
import { describeOptions } from '@/components/print/job-row';
import { QrCode } from '@/components/print/qr-code';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { findShop, getJob, setStatus } from '@/lib/print-store';
import { formatKsh, isOpen, statusLabel, statusSteps, type PrintJob, type PrintShop } from '@/lib/print-types';

// One print job: the pickup code and QR, and where the job is.
export default function PrintJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<PrintJob | null | undefined>(undefined);
  const [shop, setShop] = useState<PrintShop | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const refresh = useCallback(async () => {
    const found = await getJob(id).catch(() => null);
    setJob(found);
    if (found) findShop(found.shopId).then(setShop).catch(() => {});
  }, [id]);

  // The shop updates the status; check again every 15 seconds while open.
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  if (job === undefined) {
    return (
      <Screen>
        <SubHeader title="Print job" />
        <ActivityIndicator color={Colors.primary} />
      </Screen>
    );
  }
  if (!job) {
    return (
      <Screen>
        <SubHeader title="Print job" />
        <Note tone="warn">That print job wasn’t found.</Note>
      </Screen>
    );
  }

  const stepIndex = statusSteps.findIndex((s) => s.status === job.status);
  const cancel = async () => {
    setCancelling(true);
    setJob(await setStatus(job, 'cancelled'));
    setCancelling(false);
  };

  return (
    <Screen>
      <SubHeader title="Print job" />

      <View style={[styles.codeCard, job.status === 'ready' && styles.codeReady]}>
        <Text style={styles.codeLabel}>{job.status === 'ready' ? 'Ready! Show this at the shop' : 'Your pickup code'}</Text>
        <Text style={styles.code}>{job.code}</Text>
        {isOpen(job) && <QrCode value={job.code} />}
        <Text style={styles.status}>{statusLabel[job.status]}</Text>
      </View>

      {job.status !== 'cancelled' && (
        <Card title="Progress">
          {statusSteps.map((step, index) => (
            <CheckRow key={step.status} label={step.label} checked={index <= stepIndex} />
          ))}
          <Text style={styles.muted}>This updates when the shop moves your job along.</Text>
        </Card>
      )}

      <Card title={job.fileName}>
        <Text style={styles.item}>{describeOptions(job)}</Text>
        {!!job.note && <Text style={styles.muted}>Note: {job.note}</Text>}
        <Text style={styles.price}>{formatKsh(job.price)}</Text>
        <Text style={styles.muted}>Pay the shop when you collect. Never share your M-Pesa PIN with anyone.</Text>
      </Card>

      {shop && (
        <Card title={shop.name}>
          <Text style={styles.item}>{[shop.town, shop.county].filter(Boolean).join(', ')}</Text>
          {!!shop.hours && <Text style={styles.muted}>{shop.hours}</Text>}
          {!!shop.phone && <LinkButton label={`Call ${shop.phone}`} onPress={() => Linking.openURL(`tel:${shop.phone}`)} />}
        </Card>
      )}

      {job.status === 'sent' && (
        <View style={styles.row}>
          <Button label="Cancel this job" icon="close-circle" variant="secondary" onPress={cancel} busy={cancelling} />
        </View>
      )}
      {!isOpen(job) && <Note>The file has been removed from the shop’s screen.</Note>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  codeReady: { backgroundColor: Colors.success },
  codeLabel: { fontSize: 14, color: Colors.onDarkMuted, fontWeight: '600' },
  code: { fontSize: 34, fontWeight: '800', color: Colors.onDark, letterSpacing: 3 },
  status: { fontSize: 15, fontWeight: '700', color: Colors.onDark },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  item: { fontSize: 14, color: Colors.text },
  price: { fontSize: 18, fontWeight: '700', color: Colors.navy },
  row: { flexDirection: 'row', gap: Spacing.md },
});
