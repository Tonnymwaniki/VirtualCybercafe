import { Linking, Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

// A small Markdown renderer for attendant replies: headings, paragraphs,
// "-" bullets, "1." steps, **bold**, *italic*, `code` and links. Anything
// else shows as plain text.

type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbers'; items: string[]; start: number };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (const raw of source.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const number = /^(\d+)[.)]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (!line || /^(-{3,}|\*{3,})$/.test(line)) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ type: 'heading', text: heading[1] });
    } else if (bullet) {
      flush();
      if (last?.type === 'bullets') last.items.push(bullet[1]);
      else blocks.push({ type: 'bullets', items: [bullet[1]] });
    } else if (number) {
      flush();
      if (last?.type === 'numbers') last.items.push(number[2]);
      else blocks.push({ type: 'numbers', items: [number[2]], start: Number(number[1]) });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

function openLink(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

// **bold**, *italic*, `code`, [label](https://...) and bare https links.
const inlinePattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g;

function Inline({ text, style }: { text: string; style: TextStyle }) {
  const parts = text.split(inlinePattern).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <Text key={index} style={styles.bold}>{part.slice(2, -2)}</Text>;
        if (part.startsWith('`') && part.endsWith('`')) return <Text key={index} style={styles.code}>{part.slice(1, -1)}</Text>;
        const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
        if (link) {
          return (
            <Text key={index} style={styles.link} onPress={() => openLink(link[2])}>
              {link[1]}
            </Text>
          );
        }
        if (/^https?:\/\//.test(part)) {
          return (
            <Text key={index} style={styles.link} onPress={() => openLink(part)}>
              {part.replace(/^https?:\/\/(www\.)?/, '')}
            </Text>
          );
        }
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <Text key={index} style={styles.italic}>{part.slice(1, -1)}</Text>;
        return part;
      })}
    </Text>
  );
}

export function Markdown({ text, color = Colors.text }: { text: string; color?: string }) {
  const body: TextStyle = { ...styles.body, color };
  return (
    <View style={styles.wrap}>
      {parseBlocks(text).map((block, index) => {
        if (block.type === 'heading') return <Inline key={index} text={block.text} style={{ ...styles.heading, color }} />;
        if (block.type === 'paragraph') return <Inline key={index} text={block.text} style={body} />;
        return (
          <View key={index} style={styles.list}>
            {block.items.map((item, i) => (
              <View key={i} style={styles.item}>
                {block.type === 'bullets' ? (
                  <View style={styles.dot} />
                ) : (
                  <Text style={styles.number}>{block.start + i}.</Text>
                )}
                <Inline text={item} style={{ ...body, flex: 1 }} />
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  body: { fontSize: 15, lineHeight: 22 },
  heading: { fontSize: 16, fontWeight: '700', lineHeight: 22, marginTop: 2 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), backgroundColor: Colors.primarySoft, fontSize: 14 },
  link: { color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  list: { gap: 6 },
  item: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 8 },
  number: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: Colors.primary, minWidth: 18 },
});
