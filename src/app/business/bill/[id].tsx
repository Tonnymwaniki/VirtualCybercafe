import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DocActions } from '@/components/biz/doc-actions';
import { Button } from '@/components/button';
import { Card, Note } from '@/components/gov/ui';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Profile } from '@/data/profile-fields';
import { billHtml, billTotal, docFileName, lineTotal, nextNumber } from '@/lib/biz-docs';
import { DOC_KEY, docKinds, isBillKind, type Bill, type BillKind, type SavedDoc } from '@/lib/biz-types';
import { useAuth } from '@/lib/auth';
import { formatKsh } from '@/lib/print-types';
import { GUEST_ID, loadProfile } from '@/lib/profile-store';
import { deleteRecord, loadRecords, newId, saveRecord } from '@/lib/record-store';

type ItemText = { description: string; quantity: string; price: string };

const today = () => new Date().toISOString().slice(0, 10);

function toItems(items: ItemText[]) {
  return items
    .filter((item) => item.description.trim())
    .map((item) => ({
      description: item.description.trim().slice(0, 200),
      quantity: Math.max(0, Number(item.quantity) || 0),
      price: Math.max(0, Number(item.price) || 0),
    }));
}

// Invoice, receipt, quotation or price list: numbered, totalled and printed
// with the business details from My Details.
export default function BillScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; kind?: string; from?: string; customer?: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;

  const [profile, setProfile] = useState<Profile>({});
  const [bill, setBill] = useState<Bill | null>(null);
  const [items, setItems] = useState<ItemText[]>([]);
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      setProfile(await loadProfile(userId));
      const records = await loadRecords<SavedDoc>(userId, DOC_KEY);
      const all = Object.values(records);
      const existing = records[params.id];
      if (params.id !== 'new') {
        if (existing?.type !== 'bill') return setMissing(true);
        setBill(existing.bill);
        setItems(existing.bill.items.map((i) => ({ description: i.description, quantity: String(i.quantity), price: String(i.price) })));
        setSaved(true);
        return;
      }
      const kind: BillKind = params.kind && isBillKind(params.kind) ? params.kind : 'invoice';
      // "Make a receipt" from an invoice copies its customer and items.
      const source = params.from ? records[params.from] : undefined;
      const from = source?.type === 'bill' ? source.bill : null;
      const fresh: Bill = {
        id: newId(),
        kind,
        number: nextNumber(kind, all),
        date: today(),
        customer: from?.customer ?? params.customer?.slice(0, 120) ?? '',
        customerContact: from?.customerContact ?? '',
        items: from?.items ?? [],
        paidBy: '',
        dueDate: '',
        notes: from && kind === 'receipt' && from.number ? `For invoice ${from.number}` : '',
        createdAt: new Date().toISOString(),
      };
      setBill(fresh);
      setItems(
        fresh.items.length
          ? fresh.items.map((i) => ({ description: i.description, quantity: String(i.quantity), price: String(i.price) }))
          : [{ description: '', quantity: '1', price: '' }],
      );
    })();
  }, [userId, params.id, params.kind, params.from, params.customer]);

  if (missing) {
    return (
      <Screen>
        <SubHeader title="Document" />
        <Note tone="warn">This document was not found. It may have been deleted.</Note>
      </Screen>
    );
  }
  if (!bill) {
    return (
      <Screen>
        <SubHeader title="Document" />
      </Screen>
    );
  }

  const label = docKinds[bill.kind].label;
  const isPriceList = bill.kind === 'pricelist';
  const current: Bill = { ...bill, items: toItems(items) };
  const set = (changes: Partial<Bill>) => {
    setBill({ ...bill, ...changes });
    setSaved(false);
  };
  const setItem = (index: number, changes: Partial<ItemText>) => {
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...changes } : item)));
    setSaved(false);
  };

  const save = async () => {
    await saveRecord<SavedDoc>(userId, DOC_KEY, bill.id, { type: 'bill', bill: current });
    setSaved(true);
    if (params.id === 'new') router.replace(`/business/bill/${bill.id}` as Href);
  };

  const remove = async () => {
    await deleteRecord(userId, DOC_KEY, bill.id);
    router.back();
  };

  const input = (value: string, onChange: (text: string) => void, placeholder: string, extra?: object) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      style={styles.input}
      {...extra}
    />
  );

  return (
    <Screen>
      <SubHeader title={bill.number ? `${label} ${bill.number}` : label} />
      {!profile.businessName && (
        <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => [styles.banner, pressed && styles.dim]}>
          <Ionicons name="storefront" size={18} color={Colors.primary} />
          <Text style={styles.bannerText}>Add your business name, phone and M-Pesa till in My Details so they print on every document</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </Pressable>
      )}

      {!isPriceList && (
        <Card title={bill.kind === 'receipt' ? 'Received from' : 'Customer'}>
          {input(bill.customer, (t) => set({ customer: t }), 'Customer or company name')}
          {input(bill.customerContact, (t) => set({ customerContact: t }), 'Phone, email or address (optional)')}
        </Card>
      )}

      <Card title={isPriceList ? 'Items and prices' : 'Items'}>
        {items.map((item, index) => (
          <View key={index} style={styles.item}>
            <View style={styles.itemTop}>
              <TextInput
                value={item.description}
                onChangeText={(t) => setItem(index, { description: t })}
                placeholder="Item or service"
                placeholderTextColor={Colors.textMuted}
                style={[styles.input, styles.flex]}
              />
              <Pressable
                onPress={() => {
                  setItems((list) => list.filter((_, i) => i !== index));
                  setSaved(false);
                }}
                hitSlop={8}
                accessibilityLabel="Remove item">
                <Ionicons name="trash-outline" size={20} color={Colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.itemNumbers}>
              {!isPriceList && (
                <View style={styles.flex}>
                  <Text style={styles.small}>Quantity</Text>
                  {input(item.quantity, (t) => setItem(index, { quantity: t.replace(/[^\d.]/g, '') }), '1', { keyboardType: 'decimal-pad' })}
                </View>
              )}
              <View style={styles.flex}>
                <Text style={styles.small}>Price (KSh)</Text>
                {input(item.price, (t) => setItem(index, { price: t.replace(/[^\d.]/g, '') }), '0', { keyboardType: 'decimal-pad' })}
              </View>
              {!isPriceList && (
                <View style={styles.flex}>
                  <Text style={styles.small}>Amount</Text>
                  <Text style={styles.amount}>
                    {formatKsh(lineTotal({ quantity: Number(item.quantity) || 0, price: Number(item.price) || 0 }))}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => setItems((list) => [...list, { description: '', quantity: '1', price: '' }])}
          style={({ pressed }) => [styles.add, pressed && styles.dim]}>
          <Ionicons name="add-circle" size={20} color={Colors.primary} />
          <Text style={styles.addText}>Add an item</Text>
        </Pressable>
        {!isPriceList && <Text style={styles.total}>Total: {formatKsh(billTotal(current))}</Text>}
      </Card>

      <Card title="Details">
        <Text style={styles.small}>Date</Text>
        {input(bill.date, (t) => set({ date: t }), 'YYYY-MM-DD')}
        {(bill.kind === 'invoice' || bill.kind === 'quotation') && (
          <>
            <Text style={styles.small}>{bill.kind === 'quotation' ? 'Valid until (optional)' : 'Payment due (optional)'}</Text>
            {input(bill.dueDate, (t) => set({ dueDate: t }), 'YYYY-MM-DD')}
          </>
        )}
        {bill.kind === 'receipt' && (
          <>
            <Text style={styles.small}>Paid by</Text>
            {input(bill.paidBy, (t) => set({ paidBy: t }), 'e.g. M-Pesa QWE12RTY34, or cash')}
          </>
        )}
        <Text style={styles.small}>Notes (optional)</Text>
        {input(bill.notes, (t) => set({ notes: t }), isPriceList ? 'e.g. Prices include VAT' : 'e.g. Thank you for your business', {
          multiline: true,
          style: [styles.input, styles.multiline],
        })}
        {!profile.mpesaTill && bill.kind === 'invoice' && (
          <Note>Add your M-Pesa till or paybill in My Details and it will print on the invoice.</Note>
        )}
      </Card>

      <View style={styles.row}>
        <Button label={saved ? 'Saved' : 'Save'} icon="checkmark" onPress={save} disabled={saved || current.items.length === 0} />
        {params.id !== 'new' && <Button label="Delete" icon="trash" variant="secondary" onPress={remove} />}
      </View>
      {current.items.length === 0 && <Note>Add at least one item.</Note>}

      {current.items.length > 0 && (
        <Card title="Get the document">
          <DocActions html={billHtml(current, profile)} fileName={docFileName({ type: 'bill', bill: current })} />
          {bill.kind === 'invoice' && saved && (
            <Button
              label="Make a receipt for this invoice"
              icon="checkmark-done"
              variant="secondary"
              onPress={() => router.push(`/business/bill/new?kind=receipt&from=${bill.id}` as Href)}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  dim: { opacity: 0.7 },
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
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  item: { gap: 6, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemNumbers: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1, gap: 4 },
  small: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  amount: { fontSize: 15, fontWeight: '600', color: Colors.text, paddingVertical: 10 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  total: { fontSize: 17, fontWeight: '700', color: Colors.navy, textAlign: 'right' },
  row: { flexDirection: 'row', gap: Spacing.md },
});
