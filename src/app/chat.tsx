import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HistoryPanel } from '@/components/chat/history-panel';
import { DaySeparator, MessageBubble } from '@/components/chat/message-bubble';
import { TypingDots } from '@/components/chat/typing-dots';
import { ChatWelcome } from '@/components/chat/welcome';
import { Mascot } from '@/components/mascot';
import { useEngine } from '@/components/workbench/engine';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { entryForPath } from '@/data/catalogue';
import { findGovTask } from '@/data/gov-tasks';
import type { Profile } from '@/data/profile-fields';
import { askAttendant } from '@/lib/attendant-client';
import { fileById, keepFile } from '@/lib/chat-files';
import { useAuth } from '@/lib/auth';
import {
  dayGroup,
  deleteConversation,
  loadConversations,
  newConversation,
  sameDay,
  saveConversation,
  titleFrom,
} from '@/lib/chat-store';
import { followUps, starterSuggestions } from '@/lib/chat-suggest';
import type { ActionState, ChatAction, ChatMessage, ChatResponse, Conversation, FileMeta, WorkRequest } from '@/lib/chat-types';
import { loadContinueItems, type ContinueItem } from '@/lib/continue';
import { fileIntent, workIntro } from '@/lib/file-intent';
import { useLanguage, type TextKey } from '@/lib/i18n';
import { canUseCamera, pickImages } from '@/lib/images';
import { listFiles, type StoredFile } from '@/lib/locker-store';
import { GUEST_ID, loadProfile, usesCloud } from '@/lib/profile-store';
import { newId } from '@/lib/record-store';
import { confidentIntent, localReply } from '@/lib/route-intent';
import { isSwahili } from '@/lib/swahili';
import { taskIntent } from '@/lib/task-intent';
import { fileUri, formatSize, kindOf, lockerWorkFile, pickFiles, toBase64, type WorkFile } from '@/lib/workbench/files';
import { imageFromPicked, shrinkImage } from '@/lib/workbench/image';
import { pageCount } from '@/lib/workbench/pdf';
import { runWork } from '@/lib/workbench/run';

const statusKey = {
  ai: 'chat.online',
  local: 'chat.online',
  sample: 'chat.sample',
  limited: 'chat.resting',
  offline: 'chat.offline',
} as const;

type Status = ChatResponse['mode'] | 'limited' | 'offline';
// A file waiting to be sent, already kept for the chat.
type Attachment = { meta: FileMeta; file: WorkFile };

const MAX_ATTACHMENTS = 10;
// PDFs up to this size are also sent for the attendant to read.
const READABLE_PDF = 3 * 1024 * 1024;

// The files in a chat, oldest first: those the user sent and those the phone
// made. Only files still on the phone are listed.
function chatFiles(messages: ChatMessage[]) {
  const seen = new Map<string, FileMeta>();
  for (const m of messages) {
    for (const f of m.files ?? []) seen.set(f.id, f);
    for (const a of m.actions ?? []) {
      if (a.type === 'work' && a.outcome?.status === 'done') a.outcome.outputs.forEach((o) => seen.set(o.file.id, o.file));
    }
  }
  return [...seen.values()].filter((f) => fileById(f.id));
}

// The files a short request like "make it smaller" is about: the ones the
// user sent last, or the ones the phone made last, whichever is newer.
function latestFiles(messages: ChatMessage[]): FileMeta[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const made = (m.actions ?? []).flatMap((a) => (a.type === 'work' && a.outcome?.status === 'done' ? a.outcome.outputs.map((o) => o.file) : []));
    const found = (m.files?.length ? m.files : made).filter((f) => fileById(f.id));
    if (found.length) return found;
  }
  return [];
}

// Work that never finished (the app closed) can't be picked up again.
function settleWork(conversation: Conversation): Conversation {
  const open = conversation.messages.some((m) => m.actions?.some((a) => a.type === 'work' && !a.outcome));
  if (!open) return conversation;
  return {
    ...conversation,
    messages: conversation.messages.map((m) => ({
      ...m,
      actions: m.actions?.map((a) =>
        a.type === 'work' && !a.outcome
          ? { ...a, outcome: { status: 'failed' as const, outputs: [], notes: [], error: 'This stopped before it finished. Send the file again.' } }
          : a,
      ),
    })),
  };
}

const WIDE = 900;
const LINE = 21;
const MAX_INPUT = LINE * 5 + 18;

function dayLabel(iso: string, t: (key: TextKey) => string) {
  const group = dayGroup(iso);
  if (group === 'today') return t('chat.today');
  if (group === 'yesterday') return t('chat.yesterday');
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ChatScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const params = useLocalSearchParams<{ q?: string; task?: string; from?: string; c?: string }>();

  // The open conversation lives in a ref too, so a reply that arrives after
  // a slow request is added to the chat it belongs to.
  const [current, setCurrent] = useState<Conversation>(() => newConversation(params.task, params.from));
  const currentRef = useRef(current);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [draft, setDraft] = useState('');
  const [inputHeight, setInputHeight] = useState(LINE + 18);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachMenu, setAttachMenu] = useState(false);
  // Locker files to pick from: null while closed, 'loading', or the list.
  const [lockerPick, setLockerPick] = useState<StoredFile[] | 'loading' | 'signIn' | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // Workbench jobs from the chat still running.
  const [working, setWorking] = useState(0);
  const engine = useEngine();
  const [status, setStatus] = useState<Status>('local');
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [micNote, setMicNote] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [profile, setProfile] = useState<Profile>({});
  const [lockerNames, setLockerNames] = useState<string[]>([]);
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  // Once the AI has joined a conversation, it answers everything after.
  const usedAi = useRef(false);
  // Files of messages that failed to send, for the retry.
  const failedFiles = useRef<Record<string, Attachment[]>>({});
  const scrollRef = useRef<ScrollView>(null);
  const sentInitial = useRef(false);
  // Follow new messages down unless the person has scrolled up to read.
  const stick = useRef(true);
  const lastOffset = useRef(0);

  const messages = current.messages;
  // Opened with "Help me here": the screen the user was on.
  const screenEntry = current.screen ? entryForPath(current.screen) : undefined;
  const task = findGovTask(current.taskId ?? screenEntry?.id);
  const firstName = (profile.fullName || user?.fullName || '').split(' ')[0] || undefined;

  useEffect(() => {
    let live = true;
    loadConversations(userId)
      .then((list) => {
        if (!live) return;
        setConversations(list);
        const wanted = params.c ? list.find((c) => c.id === params.c) : undefined;
        if (wanted && !currentRef.current.messages.length) open(wanted);
      })
      .catch(() => {});
    loadProfile(userId).then((p) => live && setProfile(p)).catch(() => {});
    loadContinueItems(userId, 2).then((items) => live && setContinueItems(items)).catch(() => {});
    listFiles(userId)
      .then((files) => live && setLockerNames(files.map((f) => f.name)))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Stop reading when leaving the chat.
  useEffect(() => () => void Speech.stop(), []);

  const replace = (next: Conversation) => {
    currentRef.current = next;
    setCurrent(next);
  };

  // Saves the chat and moves it to the top of the list.
  const persist = (conversation: Conversation) => {
    if (!conversation.messages.some((m) => !m.failed)) return;
    setConversations((list) => [conversation, ...list.filter((c) => c.id !== conversation.id)]);
    saveConversation(userId, conversation).catch(() => {});
  };

  const update = (change: (conversation: Conversation) => Conversation, save = false) => {
    const next = { ...change(currentRef.current), updatedAt: new Date().toISOString() };
    replace(next);
    if (save) persist(next);
    return next;
  };

  // Changes a chat that may no longer be the open one (the user switched
  // while a slow job ran), and saves it.
  const patch = (conversationId: string, change: (conversation: Conversation) => Conversation) => {
    if (currentRef.current.id === conversationId) {
      update(change, true);
      return;
    }
    setConversations((list) =>
      list.map((c) => {
        if (c.id !== conversationId) return c;
        const next = change(c);
        saveConversation(userId, next).catch(() => {});
        return next;
      }),
    );
  };

  // Runs Workbench jobs on the phone and puts the measured results on their cards.
  const runJobs = async (conversationId: string, messageId: string, jobs: { id: string; request: WorkRequest }[]) => {
    for (const job of jobs) {
      setWorking((n) => n + 1);
      const outcome = await runWork(job.request, engine, t);
      setWorking((n) => n - 1);
      patch(conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId
            ? { ...m, actions: m.actions?.map((a) => (a.type === 'work' && a.id === job.id ? { ...a, outcome } : a)) }
            : m,
        ),
      }));
    }
  };

  const addReply = (conversationId: string, text: string, actions: ChatAction[]) => {
    const id = newId();
    update((c) => ({ ...c, messages: [...c.messages, { id, role: 'assistant', text, actions, at: new Date().toISOString() }] }), true);
    const jobs = actions.flatMap((a) => (a.type === 'work' && !a.outcome ? [{ id: a.id, request: a.request }] : []));
    if (jobs.length) runJobs(conversationId, id, jobs);
  };

  const send = async (text: string, files: Attachment[] = []) => {
    const trimmed = text.trim();
    if ((!trimmed && !files.length) || waiting) return;
    const conversationId = currentRef.current.id;
    const firstImage = files.find((f) => f.file.kind === 'image');
    const metas = files.map((f) => f.meta);
    const message: ChatMessage = {
      id: newId(),
      role: 'user',
      text: trimmed,
      at: new Date().toISOString(),
      ...(firstImage ? { imageUri: fileUri(firstImage.file) } : {}),
      ...(metas.length ? { files: metas } : {}),
    };
    const withUser = update((c) => ({
      ...c,
      title: c.title || titleFrom(trimmed || metas[0]?.name || '', !!firstImage),
      messages: [...c.messages, message],
    }));
    setDraft('');
    setInputHeight(LINE + 18);
    setAttachments([]);
    setAttachMenu(false);
    stick.current = true;
    setAtBottom(true);

    // A clear file request ("under 1MB", "600x600", "for HELB") is done on
    // the phone straight away, free.
    const targets = metas.length ? metas : latestFiles(currentRef.current.messages.slice(0, -1));
    const request = trimmed ? fileIntent(trimmed, targets) : null;
    if (request) {
      const id = newId();
      addReply(conversationId, workIntro(request, language), [{ type: 'work', id, request }]);
      return;
    }

    // "I need to apply for a job" starts the task card here, free.
    const started = !files.length && !task && !screenEntry ? taskIntent(trimmed, language) : null;
    if (started) {
      addReply(conversationId, started.reply, started.actions);
      return;
    }

    // A short request that clearly names a screen is answered here, free.
    const match = !usedAi.current && !files.length && !task && !screenEntry ? confidentIntent(trimmed) : null;
    if (match) {
      const local = localReply(trimmed, match, language);
      addReply(conversationId, local.reply, local.actions);
      return;
    }

    setWaiting(true);
    const history = withUser.messages.filter((m) => !m.failed);
    const known = chatFiles(history).map((f) => (metas.some((m) => m.id === f.id) ? { ...f, newest: true } : f));
    let image: string | undefined;
    let pdf: string | undefined;
    try {
      if (firstImage) image = toBase64((await shrinkImage(firstImage.file, 1_200_000, { maxSide: 1600 })).file.bytes);
      const readable = files.find((f) => f.file.kind === 'pdf' && f.file.bytes.byteLength <= READABLE_PDF);
      if (readable) pdf = toBase64(readable.file.bytes);
    } catch {
      // The attendant still gets the file's description.
    }
    const response = await askAttendant(history, task?.id, screenEntry ? current.screen : undefined, language, image, known, pdf);
    setWaiting(false);
    // The user switched to another chat while waiting: drop the late reply.
    if (currentRef.current.id !== conversationId) return;

    // Not signed in on the hosted app: the sign-in notice shows, and the
    // message can be sent again after signing in.
    if (response.offline || response.signIn) {
      if (files.length) failedFiles.current[message.id!] = files;
      if (response.offline) setStatus('offline');
      update((c) => ({ ...c, messages: c.messages.map((m) => (m.id === message.id ? { ...m, failed: true, failedWhy: response.why } : m)) }));
      return;
    }
    usedAi.current = response.mode === 'ai';
    setStatus(response.limited ? 'limited' : response.mode);
    addReply(conversationId, response.reply, response.actions);
  };

  // A confirm card was done, undone or skipped: keep that in the saved chat.
  const setActionState = (messageId: string | undefined, actionId: string, state: ActionState | undefined) => {
    update(
      (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId
            ? { ...m, actions: m.actions?.map((a) => (a.type === 'confirm' && a.id === actionId ? { ...a, state } : a)) }
            : m,
        ),
      }),
      true,
    );
    // New work shows under "Continue" on the welcome screen.
    loadContinueItems(userId, 2).then(setContinueItems).catch(() => {});
  };

  // A task card was linked to a saved job: keep that in the saved chat.
  const linkTask = (messageId: string | undefined, actionId: string, jobId: string) => {
    update(
      (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId ? { ...m, actions: m.actions?.map((a) => (a.type === 'task' && a.id === actionId ? { ...a, jobId } : a)) } : m,
        ),
      }),
      true,
    );
  };

  const retry = (message: ChatMessage) => {
    const files = failedFiles.current[message.id!] ?? [];
    delete failedFiles.current[message.id!];
    update((c) => ({ ...c, messages: c.messages.filter((m) => m.id !== message.id) }));
    send(message.text, files);
  };

  // A request typed on the Home screen arrives as ?q= and is sent straight away.
  useEffect(() => {
    if (params.q && !sentInitial.current) {
      sentInitial.current = true;
      send(params.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  const resetView = () => {
    Speech.stop();
    setSpeaking(null);
    setMenuFor(null);
    setDraft('');
    setAttachments([]);
    setAttachMenu(false);
    setStatus('local');
    stick.current = true;
    setAtBottom(true);
    if (!wide) setPanelOpen(false);
  };

  function open(conversation: Conversation) {
    resetView();
    usedAi.current = conversation.messages.some((m) => m.role === 'assistant' && !m.actions?.every((a) => a.type === 'open'));
    replace(settleWork(conversation));
  }

  const startNew = () => {
    resetView();
    usedAi.current = false;
    replace(newConversation());
  };

  const rename = (id: string, title: string) => {
    const target = id === currentRef.current.id ? currentRef.current : conversations.find((c) => c.id === id);
    if (!target) return;
    const next = { ...target, title };
    if (id === currentRef.current.id) replace(next);
    setConversations((list) => list.map((c) => (c.id === id ? next : c)));
    saveConversation(userId, next).catch(() => {});
  };

  const togglePin = (id: string) => {
    const target = conversations.find((c) => c.id === id);
    if (!target) return;
    const next = { ...target, pinned: !target.pinned };
    if (id === currentRef.current.id) replace({ ...currentRef.current, pinned: next.pinned });
    setConversations((list) => list.map((c) => (c.id === id ? next : c)));
    saveConversation(userId, next).catch(() => {});
  };

  const remove = (id: string) => {
    setConversations((list) => list.filter((c) => c.id !== id));
    deleteConversation(userId, id).catch(() => {});
    if (id === currentRef.current.id) startNew();
  };

  const readAloud = (id: string, text: string) => {
    Speech.stop();
    if (speaking === id) {
      setSpeaking(null);
      return;
    }
    setSpeaking(id);
    const done = () => setSpeaking((now) => (now === id ? null : now));
    Speech.speak(text.replace(/[*#`_>]/g, ''), {
      language: isSwahili(text) || language === 'sw' ? 'sw-KE' : 'en-GB',
      rate: 0.95,
      onDone: done,
      onStopped: done,
      onError: done,
    });
  };

  const copy = async (id: string, text: string) => {
    await Clipboard.setStringAsync(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied((now) => (now === id ? null : now)), 1500);
  };

  const share = async (id: string, text: string) => {
    if (Platform.OS === 'web' && !(typeof navigator !== 'undefined' && 'share' in navigator)) {
      copy(id, text);
      return;
    }
    try {
      await Share.share({ message: text });
    } catch {
      copy(id, text);
    }
  };

  const attach = async (source: 'camera' | 'library' | 'file') => {
    setAttachMenu(false);
    setPreparingPhoto(true);
    try {
      const picked =
        source === 'file'
          ? await pickFiles({ pdf: true, images: true, multiple: true })
          : await Promise.all((await pickImages(source, source === 'library')).map(imageFromPicked));
      const room = MAX_ATTACHMENTS - attachments.length;
      const added: Attachment[] = [];
      for (const file of picked.slice(0, room)) {
        // The page count helps the attendant; a locked PDF is still sent.
        if (file.kind === 'pdf') await pageCount(file).catch(() => {});
        added.push({ meta: keepFile(file), file });
      }
      setAttachments((list) => [...list, ...added]);
    } catch {
      // The picker gave something that can't be read.
    } finally {
      setPreparingPhoto(false);
    }
  };

  const openLocker = async () => {
    if (!user) return setLockerPick('signIn');
    setLockerPick('loading');
    try {
      setLockerPick((await listFiles(user.id)).filter((f) => kindOf(f.mimeType, f.name)));
    } catch {
      setLockerPick([]);
    }
  };

  const attachFromLocker = async (stored: StoredFile) => {
    setLockerPick(null);
    setAttachMenu(false);
    setPreparingPhoto(true);
    try {
      const file = await lockerWorkFile(stored);
      if (!file || attachments.length >= MAX_ATTACHMENTS) return;
      if (file.kind === 'pdf') await pageCount(file).catch(() => {});
      setAttachments((list) => [...list, { meta: keepFile(file), file }]);
    } catch {
      // Couldn't download it; the person can try again.
    } finally {
      setPreparingPhoto(false);
    }
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const near = contentSize.height - contentOffset.y - layoutMeasurement.height < 120;
    // Scrolling up (by finger, mouse wheel or keys) stops the follow.
    if (contentOffset.y < lastOffset.current - 4 && !near) stick.current = false;
    lastOffset.current = contentOffset.y;
    if (near) stick.current = true;
    setAtBottom(near || stick.current);
  };

  const onKeyPress = useCallback(
    (event: { nativeEvent: { key: string; shiftKey?: boolean }; preventDefault?: () => void }) => {
      // On a computer, Enter sends and Shift+Enter adds a line.
      if (Platform.OS === 'web' && event.nativeEvent.key === 'Enter' && !event.nativeEvent.shiftKey) {
        event.preventDefault?.();
        send(draft, attachments);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, attachments, waiting],
  );

  const greeting = task
    ? t('chat.taskGreeting', { task: task.title })
    : screenEntry
      ? t('chat.screenGreeting', { screen: screenEntry.title, help: screenEntry.help ?? screenEntry.description })
      : null;
  const suggestions = useMemo(() => starterSuggestions(profile), [profile]);
  const lastMessage = messages[messages.length - 1];
  const chips: TextKey[] = waiting || working
    ? []
    : lastMessage?.role === 'assistant'
      ? followUps(lastMessage.text, lastMessage.actions)
      : !messages.length && greeting
        ? ['follow.documents', 'follow.cost', 'follow.howLong']
        : [];
  const canSend = !!draft.trim() || attachments.length > 0;
  const title = task ? task.title : screenEntry ? screenEntry.title : current.title || t('chat.title');

  const panel = (
    <HistoryPanel
      conversations={conversations}
      activeId={current.id}
      guest={!usesCloud(userId)}
      onNew={startNew}
      onSelect={open}
      onRename={rename}
      onPin={togglePin}
      onDelete={remove}
      onClose={wide ? undefined : () => setPanelOpen(false)}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.page}>
        {wide && <View style={styles.sidePanel}>{panel}</View>}

        <View style={styles.flex}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Back"
              hitSlop={8}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </Pressable>
            {!wide && (
              <Pressable accessibilityLabel={t('chat.history')} hitSlop={8} onPress={() => setPanelOpen(true)}>
                <Ionicons name="menu" size={24} color={Colors.text} />
              </Pressable>
            )}
            <Mascot size={36} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.headerStatus, status === 'offline' && styles.offline]}>
                {working ? t('chat.working') : waiting ? t('chat.typing') : t(statusKey[status])}
              </Text>
            </View>
            <Pressable accessibilityLabel={t('chat.new')} hitSlop={8} onPress={startNew} style={styles.newChat}>
              <Ionicons name="create-outline" size={20} color={Colors.primary} />
            </Pressable>
          </View>

          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={100}
              onContentSizeChange={() => stick.current && scrollRef.current?.scrollToEnd({ animated: true })}>
              {!messages.length && !greeting && (
                <ChatWelcome
                  firstName={firstName}
                  continueItems={continueItems}
                  suggestions={suggestions}
                  onSuggestion={(text) => send(text)}
                />
              )}
              {greeting && (
                <MessageBubble
                  message={{ id: 'greeting', role: 'assistant', text: greeting }}
                  lockerNames={lockerNames}
                  menuOpen={false}
                  speaking={speaking === 'greeting'}
                  copied={copied === 'greeting'}
                  onToggleMenu={() => {}}
                  onCopy={() => copy('greeting', greeting)}
                  onSpeak={() => readAloud('greeting', greeting)}
                  onShare={() => share('greeting', greeting)}
                  onRetry={() => {}}
                />
              )}
              {messages.map((message, index) => {
                const id = message.id ?? String(index);
                const previous = messages[index - 1];
                const newDay = message.at && (!previous?.at || !sameDay(previous.at, message.at));
                return (
                  <View key={id} style={styles.turn}>
                    {newDay && <DaySeparator label={dayLabel(message.at!, t)} />}
                    <MessageBubble
                      message={message}
                      lockerNames={lockerNames}
                      menuOpen={menuFor === id}
                      speaking={speaking === id}
                      copied={copied === id}
                      onToggleMenu={() => setMenuFor(menuFor === id ? null : id)}
                      onCopy={() => copy(id, message.text)}
                      onSpeak={() => readAloud(id, message.text)}
                      onShare={() => share(id, message.text)}
                      onRetry={() => retry(message)}
                      onActionChange={(actionId, state) => setActionState(message.id, actionId, state)}
                      onTaskLink={(actionId, jobId) => linkTask(message.id, actionId, jobId)}
                    />
                  </View>
                );
              })}
              {(waiting || working > 0) && <TypingDots label={t('chat.typing')} />}
              {chips.length > 0 && (
                <View style={styles.followRow}>
                  {chips.map((key) => (
                    <Pressable key={key} onPress={() => send(t(key))} style={({ pressed }) => [styles.follow, pressed && styles.dim]}>
                      <Text style={styles.followText}>{t(key)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>

            {!atBottom && messages.length > 0 && (
              <Pressable
                accessibilityLabel={t('chat.latest')}
                onPress={() => {
                  stick.current = true;
                  setAtBottom(true);
                  scrollRef.current?.scrollToEnd({ animated: true });
                }}
                style={styles.jump}>
                <Ionicons name="arrow-down" size={18} color={Colors.primary} />
              </Pressable>
            )}

            <View style={styles.inputBar}>
              <View style={styles.inputInner}>
                {micNote && <Text style={styles.note}>{t('chat.mic')}</Text>}
                {(attachments.length > 0 || preparingPhoto) && (
                  <View style={styles.attachmentBlock}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentRow}>
                      {attachments.map(({ meta, file }) => (
                        <View key={meta.id} style={styles.attachmentItem}>
                          {file.kind === 'image' ? (
                            <Image source={{ uri: fileUri(file) }} style={styles.thumb} />
                          ) : (
                            <View style={[styles.thumb, styles.pdfThumb]}>
                              <Ionicons name="document-text" size={22} color={Colors.primary} />
                              <Text style={styles.pdfName} numberOfLines={1}>{meta.name}</Text>
                              <Text style={styles.pdfSize}>{formatSize(meta.bytes)}</Text>
                            </View>
                          )}
                          <Pressable
                            accessibilityLabel={`Remove ${meta.name}`}
                            onPress={() => setAttachments((list) => list.filter((a) => a.meta.id !== meta.id))}
                            hitSlop={6}
                            style={styles.thumbRemove}>
                            <Ionicons name="close" size={14} color={Colors.onDark} />
                          </Pressable>
                        </View>
                      ))}
                      {preparingPhoto && <ActivityIndicator color={Colors.primary} style={styles.thumbLoading} />}
                    </ScrollView>
                    <Text style={styles.noteLeft}>{t('chat.fileNote')}</Text>
                  </View>
                )}
                {attachMenu && (
                  <View style={styles.attachMenu}>
                    {canUseCamera && (
                      <Pressable onPress={() => attach('camera')} style={styles.attachOption}>
                        <Ionicons name="camera" size={18} color={Colors.primary} />
                        <Text style={styles.attachText}>{t('chat.camera')}</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => attach('library')} style={styles.attachOption}>
                      <Ionicons name="images" size={18} color={Colors.primary} />
                      <Text style={styles.attachText}>{t('chat.library')}</Text>
                    </Pressable>
                    <Pressable onPress={() => attach('file')} style={styles.attachOption}>
                      <Ionicons name="document-attach" size={18} color={Colors.primary} />
                      <Text style={styles.attachText}>{t('chat.file')}</Text>
                    </Pressable>
                    <Pressable onPress={openLocker} style={styles.attachOption}>
                      <Ionicons name="lock-closed" size={18} color={Colors.primary} />
                      <Text style={styles.attachText}>{t('chat.locker')}</Text>
                    </Pressable>
                  </View>
                )}
                {attachMenu && lockerPick && (
                  <View style={styles.lockerPick}>
                    {lockerPick === 'loading' ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : lockerPick === 'signIn' ? (
                      <Pressable onPress={() => router.push('/sign-in')}>
                        <Text style={styles.lockerLink}>{t('chat.lockerSignIn')}</Text>
                      </Pressable>
                    ) : lockerPick.length === 0 ? (
                      <Text style={styles.noteLeft}>{t('chat.lockerEmpty')}</Text>
                    ) : (
                      lockerPick.slice(0, 12).map((stored) => (
                        <Pressable
                          key={stored.path}
                          onPress={() => attachFromLocker(stored)}
                          style={({ pressed }) => [styles.lockerRow, pressed && { opacity: 0.6 }]}>
                          <Ionicons
                            name={kindOf(stored.mimeType, stored.name) === 'pdf' ? 'document-text' : 'image'}
                            size={18}
                            color={Colors.primary}
                          />
                          <Text style={styles.lockerName} numberOfLines={1}>
                            {stored.name}
                          </Text>
                          <Text style={styles.noteLeft}>{stored.bytes ? formatSize(stored.bytes) : ''}</Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
                <View style={styles.inputRow}>
                  <Pressable
                    accessibilityLabel={t('chat.attach')}
                    hitSlop={8}
                    onPress={() => {
                      setAttachMenu((v) => !v);
                      setLockerPick(null);
                    }}
                    style={styles.iconButton}>
                    <Ionicons name={attachMenu ? 'close' : 'add-circle-outline'} size={24} color={Colors.primary} />
                  </Pressable>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    onKeyPress={onKeyPress}
                    placeholder={t('chat.placeholder')}
                    placeholderTextColor={Colors.textMuted}
                    style={[styles.input, { height: Math.min(MAX_INPUT, Math.max(LINE + 18, inputHeight)) }]}
                    multiline
                    onContentSizeChange={(event) => setInputHeight(event.nativeEvent.contentSize.height)}
                    scrollEnabled={inputHeight > MAX_INPUT}
                  />
                  {canSend ? (
                    <Pressable
                      accessibilityLabel="Send"
                      onPress={() => send(draft, attachments)}
                      disabled={waiting}
                      style={({ pressed }) => [styles.sendButton, (pressed || waiting) && styles.dim]}>
                      <Ionicons name="arrow-up" size={20} color={Colors.onDark} />
                    </Pressable>
                  ) : (
                    <Pressable accessibilityLabel="Tap to speak" hitSlop={8} onPress={() => setMicNote((v) => !v)} style={styles.iconButton}>
                      <Ionicons name="mic" size={22} color={Colors.primary} />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>

        {!wide && panelOpen && (
          <View style={styles.overlay}>
            <View style={styles.drawer}>{panel}</View>
            <Pressable style={styles.backdrop} accessibilityLabel="Close" onPress={() => setPanelOpen(false)} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  page: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1 },
  sidePanel: { width: 300, borderRightWidth: 1, borderRightColor: Colors.border },
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
  offline: { color: Colors.warning },
  newChat: { padding: Spacing.xs, borderRadius: Radius.pill, backgroundColor: Colors.primarySoft },
  messages: {
    padding: Spacing.lg,
    gap: Spacing.md,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  turn: { gap: Spacing.sm },
  followRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingLeft: 36 },
  follow: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.card,
  },
  followText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  jump: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 96,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  inputBar: { padding: Spacing.md, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border },
  inputInner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.sm },
  note: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  noteLeft: { flex: 1, fontSize: 12, color: Colors.textMuted },
  attachmentBlock: { gap: 6 },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: 6, paddingRight: 6 },
  attachmentItem: { position: 'relative' },
  thumb: { width: 56, height: 56, borderRadius: Radius.sm, backgroundColor: Colors.primarySoft },
  pdfThumb: { width: 96, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  pdfName: { fontSize: 10, fontWeight: '600', color: Colors.text, maxWidth: 88 },
  pdfSize: { fontSize: 10, color: Colors.textMuted },
  thumbLoading: { width: 56, height: 56 },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachMenu: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  attachText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  lockerPick: {
    gap: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  lockerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, paddingHorizontal: Spacing.sm },
  lockerName: { flex: 1, fontSize: 14, color: Colors.text },
  lockerLink: { fontSize: 14, fontWeight: '600', color: Colors.primary, padding: Spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    backgroundColor: Colors.background,
    borderRadius: 24,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: LINE,
    color: Colors.text,
    paddingHorizontal: Spacing.sm,
    paddingTop: 9,
    paddingBottom: 9,
    textAlignVertical: 'top',
    ...Platform.select({ web: { outlineWidth: 0 } as object, default: {} }),
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', zIndex: 10 },
  drawer: { width: '82%', maxWidth: 340 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,30,91,0.45)' },
  dim: { opacity: 0.6 },
});
