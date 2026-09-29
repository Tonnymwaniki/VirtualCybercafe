import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { PhotoCheckCard } from '@/components/workbench/photo-check';
import { ResultCard, ResultList, Working } from '@/components/workbench/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { fileById } from '@/lib/chat-files';
import type { WorkOutcome, WorkRequest } from '@/lib/chat-types';
import { formatSize } from '@/lib/workbench/files';

// The result of Workbench work asked for in the chat: each new file with
// what was measured on it, and Download / Save to Locker.
export function WorkCard({ outcome, request }: { outcome?: WorkOutcome; request?: WorkRequest }) {
  if (!outcome) {
    return (
      <View style={styles.card}>
        <Working text="Working on your file…" />
      </View>
    );
  }
  if (outcome.status === 'failed') {
    return (
      <View style={[styles.card, styles.failed]}>
        <Ionicons name="alert-circle" size={18} color="#DC2626" />
        <Text style={styles.text}>{outcome.error}</Text>
      </View>
    );
  }
  const live = outcome.outputs.map((o) => ({ ...o, work: fileById(o.file.id) }));
  const note = outcome.notes.join(' ') || undefined;
  // Files are kept only while the app is open.
  if (live.some((o) => !o.work)) {
    return (
      <View style={styles.card}>
        {outcome.outputs.map((o) => (
          <Text key={o.file.id} style={styles.text}>
            • {o.file.name}, {formatSize(o.file.bytes)}
          </Text>
        ))}
        <Text style={styles.muted}>Made earlier. Files made in the chat are kept only while the app is open, so send the file again if you need it.</Text>
      </View>
    );
  }
  if (live.length > 2) {
    return (
      <View style={styles.stack}>
        <ResultList files={live.map((o) => o.work!)} title={`${live.length} files ready`} />
        {note && <Text style={styles.muted}>{note}</Text>}
      </View>
    );
  }
  return (
    <View style={styles.stack}>
      {live.map((o, i) => (
        <ResultCard key={o.file.id} file={o.work!} checks={o.checks} note={i === live.length - 1 ? note : undefined} />
      ))}
      {/* A passport photo also gets the AI check of the face and background, on tap. */}
      {request?.op === 'passport' && live[0]?.work?.kind === 'image' && (
        <PhotoCheckCard file={live[0].work} checks={['face', 'whiteBackground', 'noGlasses', 'sharp']} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  failed: { flexDirection: 'row', alignItems: 'flex-start', borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  text: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  stack: { gap: Spacing.sm },
});
