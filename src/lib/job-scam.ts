// Plain-rule scam check for job adverts. Runs on every advert, with or
// without the AI, and its warnings are merged with the AI's.

const rules: { pattern: RegExp; warning: string }[] = [
  {
    pattern: /\b(registration|processing|application|interview|training|medical|uniform|placement|booking|clearance|facilitation|commitment)\s+fees?\b/i,
    warning: 'It asks for a fee to apply, train or get a medical. Real employers do not charge you to get a job.',
  },
  {
    pattern: /\b(pay|send|deposit|transfer)\b[^.\n]{0,40}\b(ksh|kes|sh\.?|shillings|m-?pesa|paybill|till)\b/i,
    warning: 'It asks you to send money. Never pay to get a job.',
  },
  {
    pattern: /\b(paybill|till\s*(no|number)|lipa\s+na\s+m-?pesa)\b/i,
    warning: 'It gives an M-Pesa paybill or till number. Job adverts should not need payment.',
  },
  {
    pattern: /\b(no\s+interview|guaranteed\s+(job|employment|placement)|100%\s+(guaranteed|placement))\b/i,
    warning: 'It promises a job with no interview. That is a common scam sign.',
  },
  {
    pattern: /\bwhats\s?app\s+(only|us\s+only)\b/i,
    warning: 'It says to apply on WhatsApp only. Real employers give an official email or website.',
  },
  {
    pattern: /\b(earn|make)\s+(ksh|kes|sh\.?)\s?[\d,]+\s*(per|a|every)\s*(day|hour)\b/i,
    warning: 'It promises big daily pay for little work. Be careful.',
  },
];

const bigEmployer =
  /\b(ministry|county government|public service commission|government of kenya|safaricom|kenya power|kengen|kplc|kra|ntsa|kenya airways|equity bank|kcb|un\b|unicef|world bank)\b/i;
const freeEmail = /@(gmail|yahoo|hotmail|outlook|ymail)\./i;

export function scamSignals(text: string, email = ''): string[] {
  const found = rules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.warning);
  if (bigEmployer.test(text) && (freeEmail.test(email) || freeEmail.test(text))) {
    found.push('It names a big employer or the government but uses a free email like Gmail. Check the official website.');
  }
  return found;
}

export function mergeSignals(...lists: string[][]): string[] {
  const seen = new Set<string>();
  return lists.flat().filter((signal) => {
    const key = signal.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
