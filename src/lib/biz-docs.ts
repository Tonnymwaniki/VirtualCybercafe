// Business documents: numbering, totals and the printable A4 pages.

import type { Profile } from '@/data/profile-fields';
import {
  docKinds,
  type Bill,
  type BillKind,
  type BusinessPlan,
  type Poster,
  type SavedDoc,
  type WrittenDoc,
} from '@/lib/biz-types';
import { formatKsh } from '@/lib/print-types';

const prefixes: Record<BillKind, string> = { invoice: 'INV', receipt: 'RCT', quotation: 'QTN', pricelist: '' };

// The next number for this kind, one after the highest used so far.
export function nextNumber(kind: BillKind, saved: SavedDoc[]): string {
  const prefix = prefixes[kind];
  if (!prefix) return '';
  const highest = saved
    .filter((d): d is { type: 'bill'; bill: Bill } => d.type === 'bill' && d.bill.kind === kind)
    .map((d) => parseInt(d.bill.number.replace(/\D/g, ''), 10) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`;
}

export function lineTotal(item: { quantity: number; price: number }) {
  return Math.round(item.quantity * item.price * 100) / 100;
}

export function billTotal(bill: Bill) {
  return bill.items.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function docTitle(saved: SavedDoc) {
  if (saved.type === 'bill') {
    const { bill } = saved;
    const label = docKinds[bill.kind].label;
    return [bill.number || label, bill.customer].filter(Boolean).join(' · ');
  }
  const { content } = saved.doc;
  if (content.kind === 'poster') return content.poster.headline;
  if (content.kind === 'plan') return content.plan.title;
  return content.post.english.slice(0, 60);
}

export function docDate(saved: SavedDoc) {
  return saved.type === 'bill' ? saved.bill.createdAt : saved.doc.createdAt;
}

export function docId(saved: SavedDoc) {
  return saved.type === 'bill' ? saved.bill.id : saved.doc.id;
}

// A file name for the Locker and Print Hub, e.g. "invoice-INV-0003.pdf".
export function docFileName(saved: SavedDoc) {
  const base =
    saved.type === 'bill'
      ? `${saved.bill.kind}${saved.bill.number ? `-${saved.bill.number}` : ''}`
      : `${saved.doc.kind}-${docTitle(saved)}`;
  return `${base.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'document'}.pdf`;
}

function escape(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dateText(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return escape(iso);
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function contactLines(profile: Profile) {
  return [
    profile.businessLocation && [profile.businessLocation, profile.town].filter(Boolean).join(', '),
    [profile.businessPhone || profile.phone, profile.businessEmail || profile.email].filter(Boolean).join(' · '),
    profile.businessKraPin && `KRA PIN: ${profile.businessKraPin}`,
  ].filter(Boolean) as string[];
}

const baseStyle = `
  @page { size: A4; margin: 16mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #0F172A; font-size: 11pt; line-height: 1.45; margin: 0; }
  .muted { color: #64748B; }
`;

export function billHtml(bill: Bill, profile: Profile) {
  const label = docKinds[bill.kind].label.toUpperCase();
  const business = profile.businessName || profile.fullName || 'My business';
  const isPriceList = bill.kind === 'pricelist';
  const rows = bill.items
    .map(
      (item) =>
        `<tr><td>${escape(item.description)}</td>${
          isPriceList
            ? `<td class="num">${formatKsh(item.price)}</td>`
            : `<td class="num">${item.quantity}</td><td class="num">${formatKsh(item.price)}</td><td class="num">${formatKsh(lineTotal(item))}</td>`
        }</tr>`,
    )
    .join('');
  const head = isPriceList
    ? '<tr><th>Item</th><th class="num">Price</th></tr>'
    : '<tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr>';
  const meta = [
    bill.number && `<div><b>${label} NO.</b> ${escape(bill.number)}</div>`,
    `<div><b>DATE</b> ${dateText(bill.date)}</div>`,
    bill.dueDate && `<div><b>${bill.kind === 'quotation' ? 'VALID UNTIL' : 'DUE'}</b> ${dateText(bill.dueDate)}</div>`,
  ]
    .filter(Boolean)
    .join('');
  const payTo =
    bill.kind === 'receipt'
      ? `<p><b>Received with thanks${bill.paidBy ? `, paid by ${escape(bill.paidBy)}` : ''}.</b></p>`
      : profile.mpesaTill && !isPriceList
        ? `<p><b>How to pay:</b> M-Pesa ${escape(profile.mpesaTill)}</p>`
        : '';
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${label}</title><style>${baseStyle}
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1E3A8A; padding-bottom: 10px; }
  .name { font-size: 20pt; font-weight: 700; color: #1E3A8A; }
  .kind { font-size: 18pt; font-weight: 700; color: #1E3A8A; letter-spacing: 2px; text-align: right; }
  .meta { text-align: right; font-size: 10pt; margin-top: 4px; }
  .to { margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1E3A8A; color: #fff; text-align: left; padding: 7px 8px; font-size: 10pt; }
  td { border-bottom: 1px solid #E2E8F0; padding: 7px 8px; }
  .num { text-align: right; white-space: nowrap; }
  .total td { font-weight: 700; font-size: 13pt; border-bottom: none; border-top: 2px solid #1E3A8A; }
  .notes { margin-top: 18px; white-space: pre-line; }
  .foot { margin-top: 32px; font-size: 9pt; text-align: center; }
</style></head><body>
<div class="top">
  <div><div class="name">${escape(business)}</div>${contactLines(profile)
    .map((line) => `<div class="muted">${escape(line)}</div>`)
    .join('')}</div>
  <div><div class="kind">${label}</div><div class="meta">${meta}</div></div>
</div>
${
  bill.customer && !isPriceList
    ? `<div class="to"><div class="muted">${bill.kind === 'receipt' ? 'RECEIVED FROM' : bill.kind === 'quotation' ? 'QUOTATION FOR' : 'BILL TO'}</div><b>${escape(bill.customer)}</b>${
        bill.customerContact ? `<div>${escape(bill.customerContact)}</div>` : ''
      }</div>`
    : '<div class="to"></div>'
}
<table>${head}${rows}${
    isPriceList
      ? ''
      : `<tr class="total"><td colspan="3">${bill.kind === 'receipt' ? 'TOTAL PAID' : 'TOTAL'}</td><td class="num">${formatKsh(billTotal(bill))}</td></tr>`
  }</table>
${payTo}
${bill.notes ? `<div class="notes">${escape(bill.notes)}</div>` : ''}
<div class="foot muted">${escape(business)}${profile.businessRegNo ? ` · Reg. No. ${escape(profile.businessRegNo)}` : ''}</div>
</body></html>`;
}

export function posterHtml(poster: Poster, profile: Profile) {
  const business = profile.businessName || '';
  const contact = [profile.businessPhone || profile.phone, profile.businessLocation || profile.town].filter(Boolean).join(' · ');
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Poster</title><style>${baseStyle}
  @page { size: A4; margin: 0; }
  .page { height: 297mm; box-sizing: border-box; padding: 18mm 16mm; display: flex; flex-direction: column; background: #1E3A8A; color: #fff; text-align: center; }
  .business { font-size: 18pt; font-weight: 700; letter-spacing: 1px; opacity: 0.9; }
  .headline { font-size: 44pt; font-weight: 800; line-height: 1.1; margin-top: 18mm; }
  .sub { font-size: 18pt; margin-top: 8mm; opacity: 0.95; }
  ul { list-style: none; padding: 0; margin: 12mm 0 0; font-size: 17pt; }
  li { margin: 4mm 0; }
  .offer { margin: 12mm auto 0; background: #F59E0B; color: #0F172A; font-size: 24pt; font-weight: 800; padding: 6mm 10mm; border-radius: 6mm; display: inline-block; }
  .cta { margin-top: auto; font-size: 20pt; font-weight: 700; }
  .contact { font-size: 16pt; margin-top: 4mm; }
</style></head><body><div class="page">
${business ? `<div class="business">${escape(business.toUpperCase())}</div>` : ''}
<div class="headline">${escape(poster.headline)}</div>
${poster.subheadline ? `<div class="sub">${escape(poster.subheadline)}</div>` : ''}
${poster.points.length ? `<ul>${poster.points.map((p) => `<li>✓ ${escape(p)}</li>`).join('')}</ul>` : ''}
${poster.offer ? `<div><div class="offer">${escape(poster.offer)}</div></div>` : ''}
<div class="cta">${escape(poster.callToAction)}</div>
${contact ? `<div class="contact">${escape(contact)}</div>` : ''}
${profile.mpesaTill ? `<div class="contact">M-Pesa ${escape(profile.mpesaTill)}</div>` : ''}
</div></body></html>`;
}

export function planHtml(plan: BusinessPlan, profile: Profile) {
  const owner = [profile.fullName, profile.businessPhone || profile.phone, profile.businessEmail || profile.email].filter(Boolean).join(' · ');
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escape(plan.title)}</title><style>${baseStyle}
  h1 { color: #1E3A8A; font-size: 20pt; margin: 0 0 4px; }
  h2 { color: #1E3A8A; font-size: 13pt; margin: 18px 0 4px; border-bottom: 1px solid #CBD5E1; padding-bottom: 2px; }
  p { margin: 0 0 8px; white-space: pre-line; }
</style></head><body>
<h1>${escape(plan.title)}</h1>
<div class="muted">${escape([profile.businessName, profile.businessRegNo && `Reg. No. ${profile.businessRegNo}`].filter(Boolean).join(' · '))}</div>
${owner ? `<div class="muted">${escape(owner)}</div>` : ''}
${plan.sections.map((s) => `<h2>${escape(s.heading)}</h2><p>${escape(s.body)}</p>`).join('')}
</body></html>`;
}

// The printable page for a saved document; social posts have none.
export function docHtml(saved: SavedDoc, profile: Profile): string | null {
  if (saved.type === 'bill') return billHtml(saved.bill, profile);
  const doc: WrittenDoc = saved.doc;
  if (doc.content.kind === 'poster') return posterHtml(doc.content.poster, profile);
  if (doc.content.kind === 'plan') return planHtml(doc.content.plan, profile);
  return null;
}
