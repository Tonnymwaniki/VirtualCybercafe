import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Note } from '@/components/gov/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { sharePdfFromHtml } from '@/lib/images';
import { canMakePdfFile, savePdfToLocker, sendPdfToPrint } from '@/lib/pdf-file';
import { GUEST_ID } from '@/lib/profile-store';
import { supabase } from '@/lib/supabase';

// Share the document as a PDF, keep it in the Locker, or print it at a
// partner shop.
export function DocActions({ html, fileName }: { html: string; fileName: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [busy, setBusy] = useState<'locker' | 'print' | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'warn' } | null>(null);

  const toLocker = async () => {
    if (supabase && !user) {
      router.push('/sign-in');
      return;
    }
    setBusy('locker');
    setMessage(null);
    try {
      await savePdfToLocker(user?.id ?? GUEST_ID, html, fileName);
      setMessage({ text: `Saved to your Locker as ${fileName}.`, tone: 'good' });
    } catch {
      setMessage({ text: 'Couldn’t save to the Locker. Check your connection and try again.', tone: 'warn' });
    } finally {
      setBusy(null);
    }
  };

  const toPrint = async () => {
    setBusy('print');
    setMessage(null);
    try {
      await sendPdfToPrint(html, fileName);
      router.push('/print');
    } catch {
      setMessage({ text: 'Couldn’t prepare the file for printing. Try again.', tone: 'warn' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Button label="PDF" icon="download" onPress={() => sharePdfFromHtml(html)} />
        {canMakePdfFile && (
          <>
            <Button label="Save to Locker" icon="cloud-upload" variant="secondary" onPress={toLocker} busy={busy === 'locker'} />
            <Button label="Print Hub" icon="print" variant="secondary" onPress={toPrint} busy={busy === 'print'} />
          </>
        )}
      </View>
      {!canMakePdfFile && <Note>On the phone app you can also save this to your Locker or send it to Print Hub.</Note>}
      {message && <Note tone={message.tone}>{message.text}</Note>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
