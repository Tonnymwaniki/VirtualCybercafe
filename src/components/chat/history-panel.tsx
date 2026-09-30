import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { dayGroup, type DayGroup } from '@/lib/chat-store';
import type { Conversation } from '@/lib/chat-types';
import { useLanguage, type TextKey } from '@/lib/i18n';

const groupKeys: Record<DayGroup, TextKey> = {
  today: 'chat.today',
  yesterday: 'chat.yesterday',
  week: 'chat.week',
  older: 'chat.older',
};

type Props = {
  conversations: Conversation[];
  activeId: string;
  guest: boolean;
  onNew: () => void;
  onSelect: (conversation: Conversation) => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
};

function preview(conversation: Conversation) {
  const last = [...conversation.messages].reverse().find((m) => m.text.trim());
  return last ? last.text.replace(/[*#`>_]/g, '').replace(/\s+/g, ' ').trim() : '';
}

// The list of saved chats, like the side bar in Claude: New chat, search,
// then chats grouped by day with pinned ones on top.
export function HistoryPanel({ conversations, activeId, guest, onNew, onSelect, onRename, onPin, onDelete, onClose }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = needle
      ? conversations.filter((c) => c.title.toLowerCase().includes(needle) || c.messages.some((m) => m.text.toLowerCase().includes(needle)))
      : conversations;
    const pinned = found.filter((c) => c.pinned);
    const rest = found.filter((c) => !c.pinned);
    const groups: { key: string; label: string; items: Conversation[] }[] = [];
    if (pinned.length) groups.push({ key: 'pinned', label: t('chat.pinned'), items: pinned });
    for (const group of Object.keys(groupKeys) as DayGroup[]) {
      const items = rest.filter((c) => dayGroup(c.updatedAt) === group);
      if (items.length) groups.push({ key: group, label: t(groupKeys[group]), items });
    }
    return groups;
  }, [conversations, query, t]);

  return (
    <View style={styles.panel}>
      <View style={styles.top}>
        <Text style={styles.heading}>{t('chat.history')}</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={Colors.onDark} />
          </Pressable>
        )}
      </View>
      <Pressable onPress={onNew} style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}>
        <Ionicons name="add" size={20} color={Colors.onDark} />
        <Text style={styles.newText}>{t('chat.new')}</Text>
      </Pressable>
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={Colors.onDarkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('chat.search')}
          placeholderTextColor={Colors.onDarkMuted}
          style={styles.searchInput}
        />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {sections.length === 0 && <Text style={styles.empty}>{query ? t('chat.noMatch') : t('chat.noChats')}</Text>}
        {sections.map((section) => (
          <View key={section.key} style={styles.group}>
            <Text style={styles.groupLabel}>{section.label}</Text>
            {section.items.map((conversation) => {
              const active = conversation.id === activeId;
              if (renaming?.id === conversation.id) {
                const save = () => {
                  if (renaming.title.trim()) onRename(conversation.id, renaming.title.trim());
                  setRenaming(null);
                };
                return (
                  <View key={conversation.id} style={[styles.item, styles.itemActive]}>
                    <TextInput
                      autoFocus
                      value={renaming.title}
                      onChangeText={(title) => setRenaming({ id: conversation.id, title })}
                      onSubmitEditing={save}
                      style={styles.renameInput}
                    />
                    <View style={styles.rowButtons}>
                      <Pressable onPress={save} style={styles.smallButton}>
                        <Text style={styles.smallText}>{t('chat.save')}</Text>
                      </Pressable>
                      <Pressable onPress={() => setRenaming(null)} style={styles.smallButton}>
                        <Text style={styles.smallMuted}>{t('chat.cancel')}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }
              return (
                <View key={conversation.id} style={[styles.item, active && styles.itemActive]}>
                  <View style={styles.itemRow}>
                    <Pressable style={styles.flex} onPress={() => onSelect(conversation)}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {conversation.pinned ? '📌 ' : ''}
                        {conversation.title}
                      </Text>
                      <Text style={styles.itemPreview} numberOfLines={1}>
                        {preview(conversation)}
                      </Text>
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      accessibilityLabel="More"
                      onPress={() => {
                        setConfirmDelete(null);
                        setMenuFor(menuFor === conversation.id ? null : conversation.id);
                      }}>
                      <Ionicons name="ellipsis-horizontal" size={18} color={Colors.onDarkMuted} />
                    </Pressable>
                  </View>
                  {menuFor === conversation.id &&
                    (confirmDelete === conversation.id ? (
                      <View style={styles.rowButtons}>
                        <Text style={styles.confirmText}>{t('chat.deleteConfirm')}</Text>
                        <Pressable
                          onPress={() => {
                            onDelete(conversation.id);
                            setMenuFor(null);
                          }}
                          style={[styles.smallButton, styles.danger]}>
                          <Text style={styles.smallText}>{t('chat.delete')}</Text>
                        </Pressable>
                        <Pressable onPress={() => setConfirmDelete(null)} style={styles.smallButton}>
                          <Text style={styles.smallMuted}>{t('chat.cancel')}</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.rowButtons}>
                        <Pressable
                          onPress={() => {
                            onPin(conversation.id);
                            setMenuFor(null);
                          }}
                          style={styles.smallButton}>
                          <Ionicons name="pin" size={13} color={Colors.onDark} />
                          <Text style={styles.smallText}>{conversation.pinned ? t('chat.unpin') : t('chat.pin')}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setRenaming({ id: conversation.id, title: conversation.title });
                            setMenuFor(null);
                          }}
                          style={styles.smallButton}>
                          <Ionicons name="create-outline" size={13} color={Colors.onDark} />
                          <Text style={styles.smallText}>{t('chat.rename')}</Text>
                        </Pressable>
                        <Pressable onPress={() => setConfirmDelete(conversation.id)} style={styles.smallButton}>
                          <Ionicons name="trash-outline" size={13} color="#FCA5A5" />
                          <Text style={[styles.smallText, styles.dangerText]}>{t('chat.delete')}</Text>
                        </Pressable>
                      </View>
                    ))}
                </View>
              );
            })}
          </View>
        ))}
        {guest && <Text style={styles.guest}>{t('chat.guestNote')}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: Colors.navy, padding: Spacing.md, gap: Spacing.md },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xs },
  heading: { fontSize: 16, fontWeight: '700', color: Colors.onDark },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  newText: { fontSize: 15, fontWeight: '700', color: Colors.onDark },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.navyLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  searchInput: { flex: 1, color: Colors.onDark, fontSize: 14, paddingVertical: Spacing.sm },
  list: { gap: Spacing.md, paddingBottom: Spacing.lg },
  empty: { color: Colors.onDarkMuted, fontSize: 13, paddingHorizontal: Spacing.xs },
  group: { gap: 2 },
  groupLabel: { fontSize: 11, fontWeight: '700', color: Colors.onDarkMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.sm, marginBottom: 2 },
  item: { borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, gap: Spacing.sm },
  itemActive: { backgroundColor: Colors.navyLight },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemTitle: { fontSize: 14, fontWeight: '600', color: Colors.onDark },
  itemPreview: { fontSize: 12, color: Colors.onDarkMuted, marginTop: 1 },
  rowButtons: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.xs },
  smallButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  smallText: { fontSize: 12, fontWeight: '600', color: Colors.onDark },
  smallMuted: { fontSize: 12, fontWeight: '600', color: Colors.onDarkMuted },
  danger: { backgroundColor: '#DC2626' },
  dangerText: { color: '#FCA5A5' },
  confirmText: { fontSize: 12, color: Colors.onDark, marginRight: 4 },
  renameInput: { color: Colors.onDark, fontSize: 14, borderBottomWidth: 1, borderBottomColor: Colors.primary, paddingVertical: 4 },
  guest: { fontSize: 12, lineHeight: 17, color: Colors.onDarkMuted, paddingHorizontal: Spacing.xs },
  pressed: { opacity: 0.75 },
});
