// Canned attendant replies used until the AI key is set up, and as an
// offline fallback. Picks Swahili or English from the user's own words and
// offers the same action buttons the AI attendant would.

import { appTools, type AppToolId } from '@/data/guides';
import type { ChatAction } from '@/lib/chat-types';
import { matchIntent, openAction } from '@/lib/route-intent';
import { isSwahili } from '@/lib/swahili';

type Topic = {
  keywords: string[];
  en: string;
  sw: string;
  tools?: AppToolId[];
  link?: { label: string; url: string };
};

const topics: Topic[] = [
  {
    keywords: ['passport', 'pasipoti', 'paspoti'],
    en: 'Sure, I can help you apply for a passport. You will need:\n• A passport photo (600×600, under 200KB)\n• Your National ID\n• Birth certificate\n• The fee shown on eCitizen (M-Pesa works)\n\nDo you have your passport photo ready?',
    sw: 'Sawa! Nitakusaidia na hiyo. Hapa ni mahitaji ya pasipoti:\n• Picha ya pasipoti (600×600, <200KB)\n• Kitambulisho (ID)\n• Cheti cha kuzaliwa\n• Ada inayoonyeshwa kwenye eCitizen (M-Pesa inakubalika)\n\nJe, una picha ya pasipoti tayari?',
    tools: ['passport_photo', 'locker'],
    link: { label: 'Open eCitizen', url: 'https://www.ecitizen.go.ke' },
  },
  {
    keywords: ['cv', 'resume', 'wasifu', 'jobs & career'],
    en: 'Let’s build your CV together. First, what job are you applying for, and what was your most recent job or course?',
    sw: 'Tutaunda CV yako pamoja. Kwanza, unaomba kazi gani, na kazi au kozi yako ya mwisho ilikuwa gani?',
    tools: ['cv_builder'],
  },
  {
    keywords: ['print', 'chapisha', 'printi', 'copy', 'scan'],
    en: 'I can send your documents to a print shop near you. Which documents do you want printed, and in colour or black and white?',
    sw: 'Naweza kutuma nyaraka zako kwa duka la uchapishaji karibu nawe. Ni nyaraka gani, na ziwe za rangi au nyeusi na nyeupe?',
    tools: ['photos_to_pdf', 'locker'],
  },
  {
    keywords: ['job', 'kazi', 'application', 'apply'],
    en: 'Happy to help with job applications. Tell me the job title or paste the advert, and I’ll list what you need and help you write the cover letter.',
    sw: 'Nitakusaidia na maombi ya kazi. Niambie jina la kazi au bandika tangazo, nami nitakuorodheshea mahitaji na kukusaidia kuandika barua ya maombi.',
    tools: ['cv_builder', 'photos_to_pdf'],
  },
  {
    keywords: ['government', 'serikali', 'kra', 'pin', 'ecitizen', 'ntsa', 'good conduct'],
    en: 'I can walk you through that government service step by step. Which one do you need: KRA PIN, eCitizen, NTSA or Good Conduct?',
    sw: 'Naweza kukuongoza hatua kwa hatua kwenye huduma hiyo ya serikali. Unahitaji ipi: KRA PIN, eCitizen, NTSA au Cheti cha Tabia Njema?',
    link: { label: 'Open eCitizen', url: 'https://www.ecitizen.go.ke' },
  },
  {
    keywords: ['education', 'elimu', 'helb', 'kuccps', 'school', 'shule', 'chuo'],
    en: 'I can help with HELB, KUCCPS and school forms. Which one are you working on?',
    sw: 'Naweza kukusaidia na HELB, KUCCPS na fomu za shule. Unashughulikia ipi?',
    tools: ['photos_to_pdf', 'shrink_photo'],
  },
  {
    keywords: ['payment', 'pay', 'bill', 'lipa', 'kplc', 'token', 'water', 'maji', 'fees'],
    en: 'I can help you pay bills like electricity, water, internet or school fees. Which bill is it?',
    sw: 'Naweza kukusaidia kulipa bili kama umeme, maji, intaneti au karo ya shule. Ni bili gani?',
  },
];

const extraTopics: Topic[] = [
  {
    keywords: ['document', 'pdf', 'nyaraka', 'word', 'ocr'],
    en: 'I can get your documents ready: turn photos into a PDF, shrink photos for uploads, or prepare a passport photo. Which one do you need?',
    sw: 'Naweza kuandaa nyaraka zako: kubadilisha picha kuwa PDF, kupunguza ukubwa wa picha, au kuandaa picha ya pasipoti. Unahitaji ipi?',
    tools: ['photos_to_pdf', 'shrink_photo'],
  },
  {
    keywords: ['business', 'biashara', 'invoice', 'proposal'],
    en: 'I can help you register a business name, and prepare invoices or proposals. What is your business called, and is it registered yet?',
    sw: 'Naweza kukusaidia kusajili jina la biashara, na kuandaa ankara au mapendekezo. Biashara yako inaitwa nini, na imesajiliwa?',
    link: { label: 'Open Business Registration', url: 'https://brs.go.ke' },
  },
  {
    keywords: ['travel', 'visa', 'safari'],
    en: 'I can help with visa forms, travel documents and passport photos. Which country are you travelling to, and when?',
    sw: 'Naweza kukusaidia na fomu za visa, nyaraka za safari na picha za pasipoti. Unasafiri nchi gani, na lini?',
    tools: ['passport_photo'],
  },
];
topics.push(...extraTopics);

const fallback = {
  en: 'I’m your virtual attendant. I can help with government services, CVs and job applications, documents, printing and payments. What do you need done?',
  sw: 'Mimi ni mhudumu wako wa kidijitali. Naweza kukusaidia na huduma za serikali, CV na maombi ya kazi, nyaraka, uchapishaji na malipo. Unahitaji nini?',
};

export function sampleReply(text: string, preferred: 'en' | 'sw' = 'en'): { reply: string; actions: ChatAction[] } {
  const lower = text.toLowerCase();
  const language = isSwahili(text) ? 'sw' : preferred;
  const topic = topics.find((t) => t.keywords.some((k) => lower.includes(k)));
  const actions: ChatAction[] = (topic?.tools ?? []).map((tool) => ({ type: 'open', ...appTools[tool] }));
  // Point to the screen that does it, when the words clearly name one.
  const [match] = matchIntent(text, 1);
  if (match && match.score >= 4 && !actions.some((a) => a.type === 'open' && a.route === match.entry.route)) {
    actions.unshift(openAction(match.entry, {}, language));
  }
  if (topic?.link) actions.push({ type: 'link', ...topic.link });
  return { reply: (topic ?? fallback)[language], actions: actions.slice(0, 3) };
}
