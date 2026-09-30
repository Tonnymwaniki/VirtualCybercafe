import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Spacing } from '@/constants/theme';
import { canUseCamera } from '@/lib/images';

type Props = {
  onPick: (source: 'camera' | 'library') => void;
  busy?: boolean;
  libraryLabel?: string;
};

export function PickButtons({ onPick, busy, libraryLabel = 'Choose photo' }: Props) {
  return (
    <View style={styles.row}>
      {canUseCamera && (
        <Button label="Take photo" icon="camera" variant="secondary" onPress={() => onPick('camera')} disabled={busy} />
      )}
      <Button label={libraryLabel} icon="images" onPress={() => onPick('library')} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.md },
});
