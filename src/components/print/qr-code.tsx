import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

// A QR code drawn with plain views, so it needs no native module.
export function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const matrix = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, col) => qr.isDark(row, col)));
  }, [value]);
  const cell = Math.floor(size / matrix.length);
  return (
    <View accessibilityLabel={`QR code for ${value}`} style={[styles.frame, { padding: cell * 2 }]}>
      {matrix.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((dark, c) => (
            <View key={c} style={{ width: cell, height: cell, backgroundColor: dark ? '#000000' : '#FFFFFF' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: '#FFFFFF', alignSelf: 'center', borderRadius: 8 },
  row: { flexDirection: 'row' },
});
