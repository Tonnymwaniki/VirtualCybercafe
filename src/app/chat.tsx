import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { askAttendant } from '@/lib/attendant-client';
import type { ChatMessage } from '@/lib/chat-types';

const greeting: ChatMessage = {
  role: 'assistant',
  text: 'Habari! I’m your virtual attendant. Tell me what you need done, in Swahili or English.',
};

export default function ChatScreen() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const sentInitial = useRef(false);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || waiting) return;
    // The greeting is UI only; the conversation sent to the attendant starts with the user.
    const history = [...messages.slice(1), { role: 'user' as const, text: trimmed }];
    setMessages([greeting, ...history]);
    setDraft('');
    setWaiting(true);
    const response = await askAttendant(history);
    setSampleMode(response.mode === 'sample');
    setMessages((current) => [...current, { role: 'assistant', text: response.reply }]);
    setWaiting(false);
  };

  // A request typed on the Home screen arrives as ?q= and is sent straight away.
  useEffect(() => {
    if (q && !sentInitial.current) {
      sentInitial.current = true;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.avatar}>
          <Ionicons name="happy" size={20} color={Colors.onDark} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Virtual Attendant</Text>
          <Text style={styles.headerStatus}>{sampleMode ? 'Online · sample replies' : 'Online'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.bubble,
                message.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}>
              <Text style={message.role === 'user' ? styles.userText : styles.assistantText}>
                {message.text}
              </Text>
            </View>
          ))}
          {waiting && (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => send(draft)}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              returnKeyType="send"
              multiline={false}
            />
            <Pressable accessibilityLabel="Tap to speak" hitSlop={8} style={styles.micButton}>
              <Ionicons name="mic" size={20} color={Colors.primary} />
            </Pressable>
            <Pressable
              accessibilityLabel="Send"
              onPress={() => send(draft)}
              disabled={waiting}
              style={({ pressed }) => [styles.sendButton, (pressed || waiting) && styles.dim]}>
              <Ionicons name="send" size={18} color={Colors.onDark} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  headerStatus: { fontSize: 12, color: Colors.success },
  messages: {
    padding: Spacing.lg,
    gap: Spacing.md,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  bubble: { maxWidth: '85%', borderRadius: Radius.lg, padding: Spacing.md },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  userText: { color: Colors.onDark, fontSize: 15, lineHeight: 21 },
  assistantText: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  inputBar: {
    padding: Spacing.md,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    backgroundColor: Colors.background,
    borderRadius: Radius.pill,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: { flex: 1, fontSize: 15, color: Colors.text, paddingVertical: Spacing.sm },
  micButton: { padding: Spacing.xs },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.6 },
});
