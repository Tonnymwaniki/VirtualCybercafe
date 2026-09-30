// Kenyan numbers: accepts 07XX..., 01XX..., 7XX..., 2547XX... or +2547XX...
// and returns the E.164 form (+2547XXXXXXXX), or null if it doesn't look valid.
export function normaliseKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  let local: string;
  if (digits.startsWith('+254')) local = digits.slice(4);
  else if (digits.startsWith('254')) local = digits.slice(3);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;
  return /^[17]\d{8}$/.test(local) ? `+254${local}` : null;
}
