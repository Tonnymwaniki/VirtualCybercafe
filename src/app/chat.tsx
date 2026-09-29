import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
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

import { ChatActions } from '@/components/chat-actions';
import { Mascot } from '@/components/mascot';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { entryForPath } from '@/data/catalogue';
import { findGovTask } from '@/data/gov-tasks';
import { askAttendant } from '@/lib/attendant-client';
import type { ChatMessage, ChatResponse } from '@/lib/chat-types';
import { useLanguage } from '@/lib/i18n';
import { confidentIntent, localReply } from '@/lib/route-intent';
import { isSwahili } from '@/lib/swahili';

const statusKey = {
  ai: 'chat.online',
  local: 'chat.online',
  sample: 'chat.sample',
  limited: 'chat.resting',
} as const;

export default function ChatScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { q, task: taskId, from: screen } = useLocalSearchParams<{ q?: string; task?: string; from?: string }>();
  // Opened with "Help me here": the screen the user was on.
  const screenEntry = screen ? entryForPath(screen) : undefined;
  const task = findGovTask(taskId ?? screenEntry?.id);
  const greeting: ChatMessage = task
    ? { role: 'assistant', text: `Ask me anything about ${task.title}: documents, fees, where to go, or what to do next.` }
    : screenEntry
      ? {
          role: 'assistant',
          text: `You’re on ${screenEntry.title}. ${screenEntry.help ?? screenEntry.description}\n\nWhat would you like to do here?`,
        }
      : { role: 'assistant', text: t('chat.greeting') };
  // The greeting is UI only (and follows the language switch); the
  // conversation sent to the attendant starts with the user.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [mode, setMode] = useState<ChatResponse['mode'] | 'limited'>('local');
  // Index of the message being read aloud.
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [micNote, setMicNote] = useState(false);
  // Once the AI has joined the conversation, it answers everything after.
  const usedAi = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const sentInitial = useRef(false);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || waiting) return;
    const history = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(history);
    setDraft('');
    // A short request that clearly names a screen is answered here, free.
    const match = !usedAi.current && !task && !screenEntry ? confidentIntent(trimmed) : null;
    if (match) {
      const local = localReply(trimmed, match, language);
      setMessages((current) => [...current, { role: 'assistant', text: local.reply, actions: local.actions }]);
      return;
    }
    setWaiting(true);
    const response = await askAttendant(history, task?.id, screenEntry ? screen : undefined, language);
    usedAi.current = true;
    setMode(response.limited ? 'limited' : response.mode);
    setMessages((current) => [
      ...current,
      { role: 'assistant', text: response.reply, actions: response.actions },
    ]);
    setWaiting(false);
  };

  // Stop reading when leaving the chat.
  useEffect(() => () => void Speech.stop(), []);

  const readAloud = (index: number, text: string) => {
    Speech.stop();
    if (speaking === index) {
      setSpeaking(null);
      return;
    }
    setSpeaking(index);
    const done = () => setSpeaking((current) => (current === index ? null : current));
    Speech.speak(text, {
      language: isSwahili(text) || language === 'sw' ? 'sw-KE' : 'en-GB',
      rate: 0.95,
      onDone: done,
      onStopped: done,
      onError: done,
    });
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
        <Mascot size={36} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{task ? task.title : screenEntry ? screenEntry.title : t('chat.title')}</Text>
          <Text style={styles.headerStatus}>{t(statusKey[mode])}</Text>
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
          {[greeting, ...messages].map((message, index) => (
            <View key={index} style={styles.turn}>
              <View
                style={[
                  styles.bubble,
                  message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}>
                <Text style={message.role === 'user' ? styles.userText : styles.assistantText}>
                  {message.text}
                </Text>
              </View>
              {message.role === 'assistant' && (
                <Pressable
                  accessibilityLabel={speaking === index ? t('chat.stop') : t('chat.listen')}
                  hitSlop={6}
                  onPress={() => readAloud(index, message.text)}
                  style={({ pressed }) => [styles.listen, pressed && styles.dim]}>
                  <Ionicons name={speaking === index ? 'stop-circle' : 'volume-high'} size={16} color={Colors.primary} />
                  <Text style={styles.listenText}>{speaking === index ? t('chat.stop') : t('chat.listen')}</Text>
                </Pressable>
              )}
              {message.actions && message.actions.length > 0 && (
                <ChatActions actions={message.actions} />
              )}
            </View>
          ))}
          {waiting && (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          {micNote && <Text style={styles.micNote}>{t('chat.mic')}</Text>}
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => send(draft)}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              returnKeyType="send"
              multiline={false}
            />
            <Pressable accessibilityLabel="Tap to speak" hitSlop={8} onPress={() => setMicNote((v) => !v)} style={styles.micButton}>
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
  turn: { gap: Spacing.sm },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: Spacing.xs },
  listenText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  micNote: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm, maxWidth: MaxContentWidth, alignSelf: 'center' },
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
