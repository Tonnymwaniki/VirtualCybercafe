// Shapes shared by the Business workspace screens, the /api/business route
// and the business agent. Documents and tenders are private records in
// task_progress (lib/record-store.ts).

export const DOC_KEY = 'biz:doc:';
export const TENDER_KEY = 'biz:tender:';

// Itemised documents the app builds itself, with no AI.
export type BillKind = 'invoice' | 'receipt' | 'quotation' | 'pricelist';
// Documents the agent writes from the owner's answers.
export type WrittenKind = 'poster' | 'post' | 'plan';
export type DocKind = BillKind | WrittenKind;

export const docKinds: Record<DocKind, { label: string; icon: string; description: string }> = {
  invoice: { label: 'Invoice', icon: 'receipt', description: 'Ask a customer to pay' },
  receipt: { label: 'Receipt', icon: 'checkmark-done', description: 'Confirm a payment' },
  quotation: { label: 'Quotation', icon: 'document-text', description: 'Prices before a job' },
  pricelist: { label: 'Price list', icon: 'pricetags', description: 'Your products and prices' },
  poster: { label: 'Poster or flyer', icon: 'megaphone', description: 'An advert to print or share' },
  post: { label: 'Social media post', icon: 'logo-whatsapp', description: 'WhatsApp, Facebook or Instagram' },
  plan: { label: 'Business plan', icon: 'trending-up', description: 'For Hustler Fund, a bank or a SACCO' },
};

export const billKinds: BillKind[] = ['invoice', 'receipt', 'quotation', 'pricelist'];
export const writtenKinds: WrittenKind[] = ['poster', 'post', 'plan'];

export function isBillKind(kind: string): kind is BillKind {
  return (billKinds as string[]).includes(kind);
}

export function isWrittenKind(kind: string): kind is WrittenKind {
  return (writtenKinds as string[]).includes(kind);
}

export type BillItem = { description: string; quantity: number; price: number };

export type Bill = {
  id: string;
  kind: BillKind;
  // e.g. INV-0003; empty for a price list.
  number: string;
  date: string;
  customer: string;
  customerContact: string;
  items: BillItem[];
  // Receipt only: how the customer paid, e.g. "M-Pesa QWE12RTY34".
  paidBy: string;
  // Invoice and quotation: when payment is due or the quote expires.
  dueDate: string;
  notes: string;
  createdAt: string;
};

export type Poster = { headline: string; subheadline: string; points: string[]; offer: string; callToAction: string };
export type SocialPost = { english: string; swahili: string; hashtags: string[] };
export type PlanSection = { heading: string; body: string };
export type BusinessPlan = { title: string; sections: PlanSection[] };

export type WrittenContent =
  | { kind: 'poster'; poster: Poster }
  | { kind: 'post'; post: SocialPost }
  | { kind: 'plan'; plan: BusinessPlan };

// What the owner tells the agent before it writes.
export type WriteBrief = {
  // Poster and post: what to advertise. Plan: what the money is for.
  topic: string;
  // Poster and post: any offer. Plan: amount needed and the lender.
  extra: string;
  // Plan only: monthly sales, costs, customers and competitors, in their words.
  details: string;
};

export type WrittenDoc = {
  id: string;
  kind: WrittenKind;
  brief: WriteBrief;
  content: WrittenContent;
  createdAt: string;
  mode: 'ai' | 'sample';
};

export type SavedDoc = { type: 'bill'; bill: Bill } | { type: 'written'; doc: WrittenDoc };

export type WriteResult = { content: WrittenContent | null; problem: string; mode: 'ai' | 'sample' };

// ---- Tenders ----

export type TenderGroup = 'open' | 'youth' | 'women' | 'pwd' | 'agpo';

export type Tender = {
  title: string;
  entity: string;
  reference: string;
  // YYYY-MM-DD when known.
  closingDate: string;
  closingText: string;
  group: TenderGroup;
  documents: string[];
  howToApply: string;
  url: string;
  whyItFits: string;
  scamSignals: string[];
};

export type TenderSearch = { tenders: Tender[]; note: string; mode: 'ai' | 'sample' };

export const tenderStatuses = ['Saved', 'Documents ready', 'Submitted', 'Won', 'Not successful'] as const;

export type SavedTender = {
  id: string;
  tender: Tender;
  status: number;
  // Indexes of tender.documents the owner has ready.
  ready: number[];
  createdAt: string;
};

export const tenderGroupLabel: Record<TenderGroup, string> = {
  open: 'Open to all',
  youth: 'Reserved for youth (AGPO)',
  women: 'Reserved for women (AGPO)',
  pwd: 'Reserved for PWD (AGPO)',
  agpo: 'Reserved for AGPO groups',
};
