// Turns what a Kenyan user types (0712 345 678, 712345678, 254712345678, +254 712...)
// into E.164 (+254712345678). Returns null if it doesn't look like a Kenyan mobile number.
export function toKenyanE164(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('254')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  // Safaricom, Airtel, Telkom etc. mobile numbers are 9 digits starting with 7 or 1.
  if (!/^[17]\d{8}$/.test(digits)) return null;
  return `+254${digits}`;
}

// +254712345678 -> +254 712 345 678
export function formatPhone(e164: string): string {
  const match = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return match ? `+254 ${match[1]} ${match[2]} ${match[3]}` : e164;
}
