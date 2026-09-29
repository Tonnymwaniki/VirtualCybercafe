import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CheckRow, LinkButton, Note, openUrl } from '@/components/gov/ui';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { findCourses } from '@/lib/edu-client';
import { KUCCPS_KEY, kuccpsStages, type CourseSearch, type CourseSuggestion, type KuccpsPlan } from '@/lib/edu-types';
import {
  cleanGrade,
  estimateMean,
  formatGrades,
  kcseSubjects,
  levelMinimum,
  levels,
  meetsLevel,
  parseGrades,
  type Level,
} from '@/lib/kcse';
import { GUEST_ID, loadProfile, saveProfile } from '@/lib/profile-store';
import { loadRecords, saveRecord } from '@/lib/record-store';

const PORTAL = 'https://students.kuccps.net';

const emptyPlan: KuccpsPlan = { choices: [], stage: -1, stageDates: {}, interests: '', level: 'Degree' };

const fitStyle: Record<CourseSuggestion['fit'], { label: string; color: string }> = {
  likely: { label: 'Likely', color: Colors.success },
  possible: { label: 'Possible', color: Colors.warning },
  reach: { label: 'Reach', color: '#B91C1C' },
};

const sameCourse = (a: CourseSuggestion, b: CourseSuggestion) => a.programme === b.programme && a.institution === b.institution;

// KUCCPS course choice: KCSE grades, course search, ordered choices and progress.
export default function KuccpsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [meanGrade, setMeanGrade] = useState('');
  const [county, setCounty] = useState('');
  const [saved, setSaved] = useState(false);
  const [plan, setPlan] = useState<KuccpsPlan>(emptyPlan);
  const planRef = useRef<KuccpsPlan>(emptyPlan);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<CourseSearch | null>(null);

  useEffect(() => {
    loadProfile(userId).then((profile) => {
      setGrades(parseGrades(profile.kcseGrades ?? ''));
      setMeanGrade(profile.kcseMeanGrade ?? '');
      setCounty(profile.county ?? '');
    });
    loadRecords<KuccpsPlan>(userId, KUCCPS_KEY).then((records) => {
      planRef.current = { ...emptyPlan, ...records.plan };
      setPlan(planRef.current);
    });
  }, [userId]);

  const updatePlan = (change: (current: KuccpsPlan) => KuccpsPlan) => {
    const next = change(planRef.current);
    planRef.current = next;
    setPlan(next);
    return saveRecord(userId, KUCCPS_KEY, 'plan', next);
  };

  const cleaned = Object.fromEntries(
    Object.entries(grades).flatMap(([subject, g]) => {
      const grade = cleanGrade(g);
      return grade ? [[subject, grade]] : [];
    }),
  );
  const estimate = estimateMean(cleaned);
  const mean = cleanGrade(meanGrade) ?? estimate?.grade ?? null;
  const subjects = [...kcseSubjects.map((s) => s.name), ...Object.keys(grades).filter((n) => !kcseSubjects.some((s) => s.name === n))];

  const saveGrades = async () => {
    await saveProfile(userId, { kcseGrades: formatGrades(grades), kcseMeanGrade: cleanGrade(meanGrade) ?? '' });
    setSaved(true);
  };

  const search = async () => {
    setSearching(true);
    saveGrades();
    updatePlan((current) => current);
    setResult(
      await findCourses({
        grades: formatGrades(grades),
        meanGrade: mean ?? '',
        interests: plan.interests,
        level: plan.level,
        county,
      }),
    );
    setSearching(false);
  };

  const addChoice = (course: CourseSuggestion) =>
    updatePlan((current) =>
      current.choices.some((c) => sameCourse(c, course)) ? current : { ...current, choices: [...current.choices, course] },
    );

  const moveChoice = (index: number, by: number) =>
    updatePlan((current) => {
      const choices = [...current.choices];
      const target = index + by;
      if (target < 0 || target >= choices.length) return current;
      [choices[index], choices[target]] = [choices[target], choices[index]];
      return { ...current, choices };
    });

  const removeChoice = (index: number) =>
    updatePlan((current) => ({ ...current, choices: current.choices.filter((_, i) => i !== index) }));

  const setStage = (stage: number) =>
    updatePlan((current) => {
      const stageDates = Object.fromEntries(Object.entries(current.stageDates).filter(([i]) => Number(i) <= stage));
      for (let i = 0; i <= stage; i++) stageDates[i] ??= new Date().toISOString();
      return { ...current, stage, stageDates };
    });

  return (
    <Screen>
      <SubHeader title="KUCCPS course choice" />

      <Card title="Your KCSE grades">
        <Text style={styles.muted}>Type the grade for each subject you sat, e.g. B+. Leave the rest empty.</Text>
        <View style={styles.grid}>
          {subjects.map((subject) => {
            const value = grades[subject] ?? '';
            const bad = !!value.trim() && !cleanGrade(value);
            return (
              <View key={subject} style={styles.gradeRow}>
                <Text style={styles.subject}>{subject}</Text>
                <TextInput
                  accessibilityLabel={`${subject} grade`}
                  value={value}
                  onChangeText={(text) => {
                    setGrades((current) => ({ ...current, [subject]: text.toUpperCase() }));
                    setSaved(false);
                  }}
                  maxLength={2}
                  autoCapitalize="characters"
                  style={[styles.gradeInput, bad && styles.bad]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.gradeRow}>
          <Text style={styles.subject}>Mean grade on your result slip</Text>
          <TextInput
            accessibilityLabel="Mean grade"
            value={meanGrade}
            onChangeText={(text) => {
              setMeanGrade(text.toUpperCase());
              setSaved(false);
            }}
            maxLength={2}
            placeholder={estimate?.grade ?? ''}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            style={styles.gradeInput}
          />
        </View>
        {estimate && (
          <Text style={styles.muted}>
            Estimate from your subjects: {estimate.grade} ({estimate.total} points). Your result slip’s mean grade counts.
          </Text>
        )}
        {mean && (
          <Note tone="good">
            {`With ${mean} you meet the usual minimum for: ${levels.filter((l) => meetsLevel(mean, l)).join(', ') || 'none of the levels yet'}. Some courses ask for more.`}
          </Note>
        )}
        <View style={styles.row}>
          <Button label={saved ? 'Saved to My Details' : 'Save my grades'} icon="save" variant="secondary" onPress={saveGrades} />
        </View>
      </Card>

      <Card title="Find courses">
        <View style={styles.chips}>
          {levels.map((level) => (
            <Pressable
              key={level}
              onPress={() => updatePlan((current) => ({ ...current, level: level as Level }))}
              style={[styles.chip, plan.level === level && styles.chipActive, mean && !meetsLevel(mean, level) && styles.chipDim]}>
              <Text style={[styles.chipText, plan.level === level && styles.chipTextActive]}>{level}</Text>
            </Pressable>
          ))}
        </View>
        {mean && !meetsLevel(mean, plan.level) && (
          <Note tone="warn">{`${plan.level} courses usually need at least ${levelMinimum[plan.level]}. Try a lower level, or ask about bridging courses.`}</Note>
        )}
        <TextInput
          value={plan.interests}
          onChangeText={(interests) => {
            planRef.current = { ...planRef.current, interests };
            setPlan(planRef.current);
          }}
          placeholder="What would you like to study or work as? e.g. nursing, IT, teaching"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />
        <TextInput
          value={county}
          onChangeText={setCounty}
          placeholder="Preferred county (optional)"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />
        <View style={styles.row}>
          <Button label="Find courses on KUCCPS" icon="search" onPress={search} busy={searching} />
        </View>
        {result?.courses.map((course) => {
          const added = plan.choices.some((c) => sameCourse(c, course));
          return (
            <View key={`${course.programme}-${course.institution}`} style={styles.course}>
              <View style={[styles.badge, { backgroundColor: fitStyle[course.fit].color }]}>
                <Text style={styles.badgeText}>{fitStyle[course.fit].label}</Text>
              </View>
              <Text style={styles.courseTitle}>{course.programme}</Text>
              <Text style={styles.muted}>{[course.institution, course.level].filter(Boolean).join(' · ')}</Text>
              {!!course.requirement && <Text style={styles.item}>Needs: {course.requirement}</Text>}
              {!!course.lastCutoff && <Text style={styles.item}>Last cut-off: {course.lastCutoff}</Text>}
              {!!course.why && <Text style={styles.muted}>{course.why}</Text>}
              <View style={styles.row}>
                {!!course.url && <Button label="Source" icon="open-outline" variant="secondary" onPress={() => openUrl(course.url)} />}
                <Button label={added ? 'Added' : 'Add to choices'} icon={added ? 'checkmark' : 'add'} onPress={() => addChoice(course)} disabled={added} />
              </View>
            </View>
          );
        })}
        {!!result?.note && <Text style={styles.muted}>{result.note}</Text>}
      </Card>

      <Card title={`My choices (${plan.choices.length})`}>
        {plan.choices.length === 0 && <Text style={styles.muted}>Add courses from the search, then put your favourite first.</Text>}
        {plan.choices.map((course, index) => (
          <View key={`${course.programme}-${course.institution}`} style={styles.choice}>
            <Text style={styles.choiceNumber}>{index + 1}</Text>
            <View style={styles.choiceText}>
              <Text style={styles.item}>{course.programme}</Text>
              <Text style={styles.muted}>{course.institution}</Text>
            </View>
            <Pressable accessibilityLabel="Move up" onPress={() => moveChoice(index, -1)} hitSlop={6}>
              <Ionicons name="arrow-up" size={18} color={index === 0 ? Colors.border : Colors.primary} />
            </Pressable>
            <Pressable accessibilityLabel="Move down" onPress={() => moveChoice(index, 1)} hitSlop={6}>
              <Ionicons name="arrow-down" size={18} color={index === plan.choices.length - 1 ? Colors.border : Colors.primary} />
            </Pressable>
            <Pressable accessibilityLabel="Remove" onPress={() => removeChoice(index)} hitSlop={6}>
              <Ionicons name="close" size={18} color="#B91C1C" />
            </Pressable>
          </View>
        ))}
        <Note>You enter these choices yourself on the KUCCPS student portal. Only KUCCPS decides placement.</Note>
        <View style={styles.row}>
          <Button label="Open the KUCCPS portal" icon="open-outline" onPress={() => openUrl(PORTAL)} />
        </View>
      </Card>

      <Card title="Your progress">
        {kuccpsStages.map((stage, index) => (
          <CheckRow
            key={stage}
            label={stage}
            detail={index <= plan.stage && plan.stageDates[index] ? new Date(plan.stageDates[index]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : undefined}
            checked={index <= plan.stage}
            onToggle={() => setStage(index === plan.stage ? index - 1 : index)}
          />
        ))}
      </Card>

      <Note tone="warn">KUCCPS never asks you to pay an agent. Pay any application fee only through the KUCCPS portal.</Note>
      <LinkButton
        icon="chatbubbles"
        label="Ask about courses and careers"
        onPress={() =>
          router.push({
            pathname: '/chat',
            params: { q: `Help me choose KUCCPS courses. My KCSE mean grade is ${mean ?? 'not known yet'} and I'm interested in ${plan.interests || 'several areas'}.` },
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  item: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  grid: { gap: 6 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  subject: { flex: 1, fontSize: 14, color: Colors.text },
  gradeInput: {
    width: 56,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  bad: { borderColor: '#DC2626' },
  row: { flexDirection: 'row', gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipDim: { opacity: 0.5 },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  chipTextActive: { color: Colors.onDark },
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
  course: { gap: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  courseTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  badge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700', color: Colors.onDark },
  choice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  choiceNumber: { width: 22, fontSize: 15, fontWeight: '700', color: Colors.primary },
  choiceText: { flex: 1 },
});
