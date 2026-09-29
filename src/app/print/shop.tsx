import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Note } from '@/components/gov/ui';
import { describeOptions } from '@/components/print/job-row';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { DEMO_SHOP_ID, findShop, myShop, openJobFile, saveShop, setStatus, shopJobs, type ShopInput } from '@/lib/print-store';
import { formatKsh, isOpen, priceFor, statusLabel, type PrintJob, type PrintShop } from '@/lib/print-types';
import { GUEST_ID } from '@/lib/profile-store';
import { supabase } from '@/lib/supabase';

const emptyShop: ShopInput = { name: '', town: '', county: '', hours: '', phone: '', priceBw: 10, priceColour: 30 };

const shopFields: { key: keyof ShopInput; label: string; placeholder: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Shop name', placeholder: 'e.g. Baraka Cyber' },
  { key: 'town', label: 'Town', placeholder: 'e.g. Nakuru' },
  { key: 'county', label: 'County', placeholder: 'e.g. Nakuru' },
  { key: 'hours', label: 'Opening hours', placeholder: 'e.g. Mon–Sat, 8 am – 7 pm' },
  { key: 'phone', label: 'Shop phone', placeholder: '07XX XXX XXX' },
  { key: 'priceBw', label: 'Price per page, black and white (KSh)', placeholder: '10', numeric: true },
  { key: 'priceColour', label: 'Price per page, colour (KSh)', placeholder: '30', numeric: true },
];

const sections: { title: string; statuses: PrintJob['status'][] }[] = [
  { title: 'New jobs', statuses: ['sent'] },
  { title: 'Printing', statuses: ['printing'] },
  { title: 'Ready for pickup', statuses: ['ready'] },
  { title: 'Done', statuses: ['collected', 'cancelled'] },
];

// The partner shop's side of Print Hub: incoming jobs, status and pickup.
export default function ShopScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const needsSignIn = !!supabase && !user;

  const [shop, setShop] = useState<PrintShop | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<keyof ShopInput, string>>(() =>
    Object.fromEntries(Object.entries(emptyShop).map(([k, v]) => [k, String(v)])) as Record<keyof ShopInput, string>,
  );
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (needsSignIn) return;
    myShop(userId)
      .then((found) => {
        setShop(found);
        if (found) setForm(Object.fromEntries(shopFields.map((f) => [f.key, String(found[f.key])])) as Record<keyof ShopInput, string>);
      })
      .catch(() => setShop(null));
  }, [userId, needsSignIn]);

  const refresh = useCallback(async () => {
    if (!shop) return;
    setJobs(await shopJobs(shop.id).catch(() => []));
  }, [shop]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const register = async () => {
    const input: ShopInput = {
      name: form.name.trim(),
      town: form.town.trim(),
      county: form.county.trim(),
      hours: form.hours.trim(),
      phone: form.phone.trim(),
      priceBw: Math.max(0, Number(form.priceBw) || 0),
      priceColour: Math.max(0, Number(form.priceColour) || 0),
    };
    if (!input.name || !input.town) {
      setProblem('Add at least the shop name and town.');
      return;
    }
    setBusy('shop');
    setProblem('');
    try {
      setShop(await saveShop(userId, input));
      setEditing(false);
    } catch {
      setProblem('Couldn’t save the shop. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const move = async (job: PrintJob, status: PrintJob['status']) => {
    setBusy(job.id);
    try {
      const updated = await setStatus(job, status);
      setJobs((current) => current.map((j) => (j.id === job.id ? updated : j)));
    } catch {
      setProblem('Couldn’t update the job. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const open = async (job: PrintJob) => {
    try {
      await openJobFile(job);
    } catch {
      setProblem('Couldn’t open the file. It may have been removed.');
    }
  };

  const typed = code.trim().toUpperCase().replace(/^VC-?/, '');
  const match = typed.length === 4 ? jobs.find((j) => j.code === `VC-${typed}` && isOpen(j)) : undefined;

  if (needsSignIn) {
    return (
      <Screen>
        <SubHeader title="Print shop" />
        <Card title="Sign in as the shop owner">
          <Text style={styles.muted}>Sign in with the shop’s phone number to receive print jobs.</Text>
          <View style={styles.row}>
            <Button label="Sign in" onPress={() => router.push('/sign-in')} />
          </View>
        </Card>
      </Screen>
    );
  }

  if (shop === undefined) {
    return (
      <Screen>
        <SubHeader title="Print shop" />
      </Screen>
    );
  }

  if (!shop || editing) {
    return (
      <Screen>
        <SubHeader title={shop ? 'Edit my shop' : 'Register my cybercafe'} />
        <Text style={styles.intro}>
          Join Print Hub as a partner shop. Customers send you documents from the app and collect them with a pickup code.
          They pay you directly.
        </Text>
        <Card>
          {shopFields.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                value={form[field.key]}
                onChangeText={(text) => setForm((current) => ({ ...current, [field.key]: field.numeric ? text.replace(/[^\d.]/g, '') : text }))}
                placeholder={field.placeholder}
                placeholderTextColor={Colors.textMuted}
                keyboardType={field.numeric ? 'decimal-pad' : field.key === 'phone' ? 'phone-pad' : 'default'}
                style={styles.input}
              />
            </View>
          ))}
        </Card>
        {!!problem && <Note tone="warn">{problem}</Note>}
        <View style={styles.row}>
          <Button label={shop ? 'Save changes' : 'Register my shop'} icon="storefront" onPress={register} busy={busy === 'shop'} />
        </View>
        {!shop && !supabase && (
          <View style={styles.row}>
            <Button
              label="Try the demo shop instead"
              variant="secondary"
              onPress={async () => setShop(await findShop(DEMO_SHOP_ID))}
            />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <SubHeader title={shop.name} />
      <Text style={styles.muted}>
        {[shop.town, shop.county].filter(Boolean).join(', ')} · {formatKsh(shop.priceBw)} black and white · {formatKsh(shop.priceColour)} colour
      </Text>

      <Card title="Customer collecting?">
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Type their pickup code, e.g. VC-4821"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          style={styles.input}
        />
        {typed.length === 4 && !match && <Note tone="warn">No open job has that code. Check it again.</Note>}
        {match && (
          <>
            <Text style={styles.item}>
              {match.customerName || 'Customer'} · {match.fileName}
            </Text>
            <Text style={styles.muted}>
              {statusLabel[match.status]} · {formatKsh(priceFor(shop, match))} to collect
            </Text>
            {match.status !== 'ready' && <Note tone="warn">This job isn’t marked ready yet.</Note>}
            <View style={styles.row}>
              <Button
                label="Handed over and paid"
                icon="checkmark-done"
                onPress={async () => {
                  await move(match, 'collected');
                  setCode('');
                }}
                busy={busy === match.id}
              />
            </View>
          </>
        )}
      </Card>

      {!!problem && <Note tone="warn">{problem}</Note>}

      {sections.map((section) => {
        const list = jobs.filter((j) => section.statuses.includes(j.status)).slice(0, section.title === 'Done' ? 10 : 50);
        return (
          <View key={section.title} style={styles.section}>
            <Text style={styles.heading}>
              {section.title} ({list.length})
            </Text>
            {list.length === 0 && <Text style={styles.muted}>None.</Text>}
            {list.map((job) => (
              <View key={job.id} style={styles.job}>
                <View style={styles.jobTop}>
                  <Text style={styles.code}>{job.code}</Text>
                  <Text style={styles.priceText}>{formatKsh(priceFor(shop, job))}</Text>
                </View>
                <Text style={styles.item} numberOfLines={1}>
                  {job.fileName}
                </Text>
                <Text style={styles.muted}>{describeOptions(job)}</Text>
                <Text style={styles.muted}>
                  {[job.customerName, job.customerPhone].filter(Boolean).join(' · ') || 'Customer'}
                  {' · '}
                  {new Date(job.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
                {!!job.note && <Text style={styles.item}>Note: {job.note}</Text>}
                {isOpen(job) && (
                  <View style={styles.row}>
                    <Button label="Open file" icon="open-outline" variant="secondary" onPress={() => open(job)} />
                    {job.status === 'sent' && (
                      <Button label="Start printing" icon="print" onPress={() => move(job, 'printing')} busy={busy === job.id} />
                    )}
                    {job.status === 'printing' && (
                      <Button label="Mark ready" icon="checkmark" onPress={() => move(job, 'ready')} busy={busy === job.id} />
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        );
      })}

      <View style={styles.row}>
        <Button label="Refresh" icon="refresh" variant="secondary" onPress={refresh} />
        {shop.id !== DEMO_SHOP_ID && <Button label="Edit my shop" icon="create" variant="secondary" onPress={() => setEditing(true)} />}
      </View>
      <Note>Files disappear from this screen once a job is collected or cancelled.</Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted, lineHeight: 21 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  item: { fontSize: 14, color: Colors.text },
  heading: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  row: { flexDirection: 'row', gap: Spacing.md },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text },
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
  section: { gap: Spacing.sm },
  job: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: 4,
  },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between' },
  code: { fontSize: 16, fontWeight: '700', color: Colors.navy, letterSpacing: 1 },
  priceText: { fontSize: 15, fontWeight: '700', color: Colors.text },
});
