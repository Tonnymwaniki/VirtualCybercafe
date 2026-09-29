import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

// The attendant's robot face, drawn with plain views so it needs no image
// and stays sharp at any size.
export function Mascot({ size = 40 }: { size?: number }) {
  const unit = size / 10;
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={[styles.antenna, { width: unit * 0.6, height: unit * 1.6, borderRadius: unit }]} />
      <View style={[styles.ball, { width: unit * 1.6, height: unit * 1.6, borderRadius: unit, top: -unit * 0.3 }]} />
      <View
        style={[
          styles.head,
          { width: size, height: unit * 7.6, borderRadius: unit * 2.4, marginTop: -unit * 0.5, padding: unit * 0.9 },
        ]}>
        <View style={[styles.face, { borderRadius: unit * 1.6, gap: unit * 0.6 }]}>
          <View style={[styles.eyes, { gap: unit * 1.8 }]}>
            <View style={[styles.eye, { width: unit * 1.4, height: unit * 1.8, borderRadius: unit }]} />
            <View style={[styles.eye, { width: unit * 1.4, height: unit * 1.8, borderRadius: unit }]} />
          </View>
          <View
            style={[
              styles.smile,
              { width: unit * 3, height: unit * 1.5, borderBottomLeftRadius: unit * 1.5, borderBottomRightRadius: unit * 1.5 },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  antenna: { backgroundColor: Colors.navy },
  ball: { position: 'absolute', backgroundColor: Colors.primary },
  head: { backgroundColor: Colors.navy },
  face: { flex: 1, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  eyes: { flexDirection: 'row' },
  eye: { backgroundColor: Colors.navy },
  smile: { backgroundColor: Colors.primary },
});
