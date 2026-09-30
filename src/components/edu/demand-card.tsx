import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, LinkButton, Note, openUrl } from '@/components/gov/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { checkDemand } from '@/lib/edu-client';
import type { CourseDemand, DemandReport } from '@/lib/edu-types';

const demandStyle: Record<CourseDemand['demand'], { label: string; color: string }> = {
  high: { label: 'High demand', color: Colors.success },
  medium: { label: 'Medium demand', color: Colors.warning },
  low: { label: 'Low demand', color: '#B91C1C' },
};

type Props = {
  choices: string[];
  meanGrade: string;
  report?: DemandReport;
  onReport: (report: DemandReport) => void;
};

// Live job-market research: how much each course is wanted by employers now.
export function DemandCard({ choices, meanGrade, report, onReport }: Props) {
  const [typed, setTyped] = useState('');
  const [checking, setChecking] = useState(false);
  const extra = typed.split(',').map((t) => t.trim()).filter(Boolean);
  const programmes = [...new Set([...choices, ...extra])].slice(0, 6);

  const run = async (list: string[]) => {
    if (!list.length) return;
    setChecking(true);
    onReport(await checkDemand(list, meanGrade));
    setChecking(false);
  };

  return (
    <Card title="Job market check">
      <Text style={styles.muted}>
        I search current job adverts and official figures to compare how much employers want each course, the jobs it leads
        to and the skills they ask for.
      </Text>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        placeholder={choices.length ? 'Add other courses to compare (optional)' : 'Type courses, separated by commas'}
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
      />
      <View style={styles.row}>
        <Button
          label={programmes.length ? `Compare ${programmes.length} course${programmes.length === 1 ? '' : 's'}` : 'Compare courses'}
          icon="trending-up"
          onPress={() => run(programmes)}
          busy={checking}
          disabled={!programmes.length}
        />
      </View>

      {report && (
        <>
          {report.courses.map((course) => (
            <View key={course.programme} style={styles.course}>
              <View style={[styles.badge, { backgroundColor: demandStyle[course.demand].color }]}>
                <Text style={styles.badgeText}>{demandStyle[course.demand].label}</Text>
              </View>
              <Text style={styles.title}>{course.programme}</Text>
              {!!course.openingsSeen && <Text style={styles.muted}>{course.openingsSeen}</Text>}
              {course.roles.length > 0 && <Text style={styles.item}>Jobs: {course.roles.join(', ')}</Text>}
              {!!course.salary && <Text style={styles.item}>Pay: {course.salary}</Text>}
              {course.skills.length > 0 && <Text style={styles.item}>Skills wanted: {course.skills.join(', ')}</Text>}
              {!!course.note && <Text style={styles.muted}>{course.note}</Text>}
            </View>
          ))}
          {!!report.summary && <Note tone={report.mode === 'ai' ? 'info' : 'warn'}>{report.summary}</Note>}
          {report.alternatives.length > 0 && (
            <View style={styles.course}>
              <Text style={styles.title}>Related courses with stronger demand</Text>
              {report.alternatives.map((alt) => (
                <View key={alt.programme} style={styles.alt}>
                  <View style={styles.altText}>
                    <Text style={styles.item}>{alt.programme}</Text>
                    <Text style={styles.muted}>{alt.why}</Text>
                  </View>
                  <LinkButton
                    label="Compare"
                    icon="arrow-forward-circle"
                    onPress={() => run([...new Set([...programmes, alt.programme])].slice(0, 6))}
                  />
                </View>
              ))}
            </View>
          )}
          {report.sources.map((source) => (
            <LinkButton key={source.url} label={source.title} onPress={() => openUrl(source.url)} />
          ))}
          <Text style={styles.muted}>
            Checked {new Date(report.checkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
            Demand changes; choose what you also enjoy and can do well.
          </Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  item: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  title: { fontSize: 15, fontWeight: '600', color: Colors.text },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  row: { flexDirection: 'row', gap: Spacing.md },
  course: { gap: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  badge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700', color: Colors.onDark },
  alt: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  altText: { flex: 1 },
});
