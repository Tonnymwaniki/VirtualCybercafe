// Canned attendant replies used until the AI key is set up, and as an
// offline fallback. Picks Swahili or English from the user's own words.

const swahiliWords = [
  'nataka',
  'nisaidie',
  'naomba',
  'habari',
  'jinsi',
  'kupata',
  'kuapply',
  'pasipoti',
  'kazi',
  'barua',
  'chapisha',
  'lipa',
  'sawa',
  'asante',
];

type Topic = {
  keywords: string[];
  en: string;
  sw: string;
};

const topics: Topic[] = [
  {
    keywords: ['passport', 'pasipoti', 'paspoti'],
    en: 'Sure, I can help you apply for a passport. You will need:\n• A passport photo (600×600, under 200KB)\n• Your National ID\n• Birth certificate\n• Payment of KSh 6,000 (M-Pesa works)\n\nDo you have your passport photo ready?',
    sw: 'Sawa! Nitakusaidia na hiyo. Hapa ni mahitaji ya pasipoti:\n• Picha ya pasipoti (600×600, <200KB)\n• Kitambulisho (ID)\n• Cheti cha kuzaliwa\n• Malipo ya ada (KSh 6,000)\n\nJe, una picha ya pasipoti tayari?',
  },
  {
    keywords: ['cv', 'resume', 'wasifu'],
    en: 'Let’s build your CV together. First, what job are you applying for, and what was your most recent job or course?',
    sw: 'Tutaunda CV yako pamoja. Kwanza, unaomba kazi gani, na kazi au kozi yako ya mwisho ilikuwa gani?',
  },
  {
    keywords: ['print', 'chapisha', 'printi', 'copy'],
    en: 'I can send your documents to a print shop near you. Which documents do you want printed, and in colour or black and white?',
    sw: 'Naweza kutuma nyaraka zako kwa duka la uchapishaji karibu nawe. Ni nyaraka gani, na ziwe za rangi au nyeusi na nyeupe?',
  },
  {
    keywords: ['job', 'kazi', 'application', 'apply'],
    en: 'Happy to help with job applications. Tell me the job title or paste the advert, and I’ll list what you need and help you write the cover letter.',
    sw: 'Nitakusaidia na maombi ya kazi. Niambie jina la kazi au bandika tangazo, nami nitakuorodheshea mahitaji na kukusaidia kuandika barua ya maombi.',
  },
  {
    keywords: ['kra', 'pin', 'ecitizen', 'ntsa', 'good conduct', 'id'],
    en: 'I can walk you through that government service step by step. Which one do you need: KRA PIN, eCitizen, NTSA or Good Conduct?',
    sw: 'Naweza kukuongoza hatua kwa hatua kwenye huduma hiyo ya serikali. Unahitaji ipi: KRA PIN, eCitizen, NTSA au Cheti cha Tabia Njema?',
  },
  {
    keywords: ['helb', 'kuccps', 'school', 'shule', 'chuo'],
    en: 'I can help with HELB, KUCCPS and school forms. Which one are you working on?',
    sw: 'Naweza kukusaidia na HELB, KUCCPS na fomu za shule. Unashughulikia ipi?',
  },
  {
    keywords: ['pay', 'bill', 'lipa', 'kplc', 'token', 'water', 'maji', 'fees'],
    en: 'I can help you pay bills like electricity, water, internet or school fees. Which bill is it?',
    sw: 'Naweza kukusaidia kulipa bili kama umeme, maji, intaneti au karo ya shule. Ni bili gani?',
  },
];

const fallback = {
  en: 'I’m your virtual attendant. I can help with government services, CVs and job applications, documents, printing and payments. What do you need done?',
  sw: 'Mimi ni mhudumu wako wa kidijitali. Naweza kukusaidia na huduma za serikali, CV na maombi ya kazi, nyaraka, uchapishaji na malipo. Unahitaji nini?',
};

export function isSwahili(text: string) {
  const words = text.toLowerCase().split(/[^a-z']+/);
  return words.some((word) => swahiliWords.includes(word));
}

export function sampleReply(text: string) {
  const lower = text.toLowerCase();
  const language = isSwahili(text) ? 'sw' : 'en';
  const topic = topics.find((t) => t.keywords.some((k) => lower.includes(k)));
  return (topic ?? fallback)[language];
}
