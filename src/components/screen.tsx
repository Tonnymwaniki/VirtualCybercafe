import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

// scrollKey: when it changes (e.g. the step of a guided task), the screen
// scrolls back to the top. scrollRef lets a screen scroll to a part of itself.
export function Screen({ children, scrollKey, scrollRef: given }: { children: ReactNode; scrollKey?: string | number; scrollRef?: RefObject<ScrollView | null> }) {
  const scrollRef = useRef<ScrollView>(null);
  // The scroll view keeps the ref it was first given, so hand ours over.
  useEffect(() => {
    if (given) given.current = scrollRef.current;
  });
  useEffect(() => {
    if (scrollKey !== undefined) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollKey]);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.lg, gap: Spacing.lg },
});
