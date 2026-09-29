// Print Hub shapes, prices and pickup codes.

export type PrintShop = {
  id: string;
  ownerId: string;
  name: string;
  town: string;
  county: string;
  hours: string;
  phone: string;
  priceBw: number;
  priceColour: number;
  active: boolean;
};

export type PrintStatus = 'sent' | 'printing' | 'ready' | 'collected' | 'cancelled';

export const statusSteps: { status: PrintStatus; label: string }[] = [
  { status: 'sent', label: 'Sent to the shop' },
  { status: 'printing', label: 'Printing' },
  { status: 'ready', label: 'Ready for pickup' },
  { status: 'collected', label: 'Collected' },
];

export const statusLabel: Record<PrintStatus, string> = {
  sent: 'Sent',
  printing: 'Printing',
  ready: 'Ready for pickup',
  collected: 'Collected',
  cancelled: 'Cancelled',
};

export type PrintJob = {
  id: string;
  userId: string;
  shopId: string;
  code: string;
  customerName: string;
  customerPhone: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  pages: number;
  copies: number;
  colour: boolean;
  doubleSided: boolean;
  price: number;
  note: string;
  status: PrintStatus;
  createdAt: string;
  updatedAt: string;
  // Demo mode only: where the file lives on this device.
  localUri?: string;
};

export type PrintOptions = { pages: number; copies: number; colour: boolean; doubleSided: boolean };

export function priceFor(shop: Pick<PrintShop, 'priceBw' | 'priceColour'>, options: PrintOptions) {
  return options.pages * options.copies * (options.colour ? shop.priceColour : shop.priceBw);
}

export function isOpen(job: PrintJob) {
  return job.status === 'sent' || job.status === 'printing' || job.status === 'ready';
}

export function newCode() {
  return `VC-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function formatKsh(amount: number) {
  return `KSh ${Math.round(amount).toLocaleString('en-KE')}`;
}
