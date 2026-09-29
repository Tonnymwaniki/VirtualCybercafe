import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChatCards } from '@/components/chat/cards';
import { Markdown } from '@/components/chat/markdown';
import { Mascot } from '@/components/mascot';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clockTime } from '@/lib/chat-store';
import type { ActionState, ChatMessage } from '@/lib/chat-types';
import { useLanguage } from '@/lib/i18n';
import { formatSize } from '@/lib/workbench/files';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  message: ChatMessage;
  lockerNames: string[];
  menuOpen: boolean;
  speaking: boolean;
  copied: boolean;
  onToggleMenu: () => void;
  onCopy: () => void;
  onSpeak: () => void;
  onShare: () => void;
  onRetry: () => void;
  onActionChange?: (id: string, state: ActionState | undefined) => void;
  onTaskLink?: (id: string, jobId: string) => void;
};

function MenuButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={15} color={Colors.primary} />
      <Text style={styles.menuText}>{label}</Text>
    </Pressable>
  );
}

// One chat message: the user's words on the right in blue, the attendant's
// formatted answer on the left with its cards underneath and buttons to
// read it aloud, copy or share. Tap and hold your own message (or tap its
// time) to copy or share it.
export function MessageBubble({ message, lockerNames, menuOpen, speaking, copied, onToggleMenu, onCopy, onSpeak, onShare, onRetry, onActionChange, onTaskLink }: Props) {
  const { t } = useLanguage();
  const mine = message.role === 'user';
  const time = message.at ? clockTime(message.at) : '';

  const menu = menuOpen && (
    <View style={[styles.menu, mine && styles.menuMine]}>
      <MenuButton icon={copied ? 'checkmark' : 'copy-outline'} label={copied ? t('chat.copied') : t('chat.copy')} onPress={onCopy} />
      <MenuButton icon="share-social-outline" label={t('chat.share')} onPress={onShare} />
    </View>
  );

  if (mine) {
    return (
      <View style={styles.mineWrap}>
        <Pressable onLongPress={onToggleMenu} delayLongPress={350} style={[styles.bubble, styles.userBubble, message.failed && styles.failedBubble]}>
          {message.imageUri ? (
            <Image source={{ uri: message.imageUri }} style={styles.photo} resizeMode="cover" accessibilityLabel={t('chat.photo')} />
          ) : message.hadImage && !message.files?.length ? (
            <View style={styles.photoNote}>
              <Ionicons name="image" size={14} color={Colors.onDark} />
              <Text style={styles.photoNoteText}>{t('chat.photoSent')}</Text>
            </View>
          ) : null}
          {!!message.files?.length && !(message.imageUri && message.files.length === 1) && (
            <View style={styles.fileChips}>
              {message.files.map((file) => (
                <View key={file.id} style={styles.fileChip}>
                  <Ionicons name={file.kind === 'pdf' ? 'document-text' : 'image'} size={14} color={Colors.onDark} />
                  <Text style={styles.fileChipText} numberOfLines={1}>
                    {file.name} · {formatSize(file.bytes)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {!!message.text && <Text style={styles.userText}>{message.text}</Text>}
        </Pressable>
        {message.failed ? (
          <Pressable onPress={onRetry} hitSlop={6} style={styles.retry}>
            <Ionicons name="alert-circle" size={14} color="#DC2626" />
            <Text style={styles.retryText}>{t('chat.retry')}</Text>
          </Pressable>
        ) : (
          !!time && (
            <Pressable onPress={onToggleMenu} hitSlop={6}>
              <Text style={[styles.time, styles.timeMine]}>{time}</Text>
            </Pressable>
          )
        )}
        {menu}
      </View>
    );
  }

  return (
    <View style={styles.theirsWrap}>
      <View style={styles.theirsRow}>
        <View style={styles.avatar}>
          <Mascot size={28} />
        </View>
        <View style={styles.theirsBody}>
          {!!message.text.trim() && (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <Markdown text={message.text} />
            </View>
          )}
          {!!message.actions?.length && <ChatCards actions={message.actions} lockerNames={lockerNames} onActionChange={onActionChange} onTaskLink={onTaskLink} />}
          <View style={styles.metaRow}>
            {!!time && <Text style={styles.time}>{time}</Text>}
            <Pressable onPress={onSpeak} hitSlop={6} accessibilityLabel={speaking ? t('chat.stop') : t('chat.listen')}>
              <Ionicons name={speaking ? 'stop-circle' : 'volume-high-outline'} size={16} color={Colors.primary} />
            </Pressable>
            <Pressable onPress={onCopy} hitSlop={6} accessibilityLabel={t('chat.copy')}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={Colors.primary} />
            </Pressable>
            <Pressable onPress={onShare} hitSlop={6} accessibilityLabel={t('chat.share')}>
              <Ionicons name="share-social-outline" size={15} color={Colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export function DaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.separator}>
      <View style={styles.line} />
      <Text style={styles.separatorText}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  fileChips: { gap: 4 },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  fileChipText: { flexShrink: 1, fontSize: 13, color: Colors.onDark },
  mineWrap: { alignItems: 'flex-end', gap: 4 },
  theirsWrap: { alignItems: 'flex-start' },
  theirsRow: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
  avatar: { paddingTop: 2 },
  theirsBody: { flex: 1, gap: Spacing.sm, alignItems: 'flex-start' },
  bubble: { borderRadius: Radius.lg, padding: Spacing.md },
  userBubble: { maxWidth: '85%', backgroundColor: Colors.primary, borderBottomRightRadius: 4, gap: Spacing.sm },
  failedBubble: { opacity: 0.6 },
  assistantBubble: {
    alignSelf: 'stretch',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopLeftRadius: 4,
  },
  userText: { color: Colors.onDark, fontSize: 15, lineHeight: 21 },
  photo: { width: 220, height: 220, borderRadius: Radius.md, backgroundColor: Colors.navyLight },
  photoNote: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  photoNoteText: { fontSize: 12, color: Colors.onDarkMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xs },
  time: { fontSize: 11, color: Colors.textMuted },
  timeMine: { paddingHorizontal: Spacing.xs },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  retryText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  menu: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    padding: 4,
  },
  menuMine: { alignSelf: 'flex-end' },
  menuButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  menuText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  separator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.xs },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  separatorText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  pressed: { opacity: 0.6 },
});
