// The English/Kiswahili switch for the app's own words: Home, menus, service
// tiles, buttons and step names. Task details (requirements, steps) stay in
// English for now. The choice is kept on the device.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'sw';

const en = {
  'tab.home': 'Home',
  'tab.services': 'Services',
  'tab.locker': 'Locker',
  'greeting.morning': 'Good morning',
  'greeting.afternoon': 'Good afternoon',
  'greeting.evening': 'Good evening',
  'home.subtitle': 'What do you need done today?',
  'home.placeholder': 'Tell me what you need done...',
  'home.goStraight': 'Go straight there',
  'home.examples': 'Examples',
  'home.quickServices': 'Quick Services',
  'home.moreServices': 'More services',
  'home.bannerTitle': 'From digital to physical. We’ve got you.',
  'home.bannerText': 'Complete online tasks, get documents printed, and more, all in one place.',
  'trust.secure': 'Secure & private',
  'trust.secureText': 'Your data is always protected',
  'trust.fast': 'Fast & reliable',
  'trust.fastText': 'Get things done, quickly',
  'trust.local': 'Local support',
  'trust.localText': 'Available in Kiswahili and English',
  'example.passport': 'Apply for a passport',
  'example.cv': 'Help me create a CV',
  'example.print': 'Print my documents',
  'example.job': 'Find a job application',
  'continue.title': 'Continue where you left off',
  'continue.next': 'Next: {step}',
  'continue.started': 'Started',
  'continue.trip': 'Trip to {place}',
  'welcome.title': 'Karibu! I’m your cyber attendant',
  'welcome.point1': 'Tell me what you need, in Swahili or English, and I’ll take you to the right place.',
  'welcome.point2': 'Save your details once in My Details. Every form and CV fills itself.',
  'welcome.point3': 'Stuck on any screen? Tap Help at the top and I’ll explain it.',
  'welcome.try': 'Try one:',
  'welcome.done': 'Got it',
  'welcome.kra': 'Get a KRA PIN',
  'welcome.job': 'Apply for a job',
  'welcome.travel': 'Travel abroad',
  'welcome.print': 'Print a document',
  'services.title': 'Services',
  'services.intro': 'Everything a cybercafe does, from your phone.',
  'services.language': 'Language',
  'services.account': 'Your account',
  'service.government': 'Government Services',
  'service.government.short': 'Government',
  'service.government.text': 'eCitizen, KRA, NTSA, passports and more',
  'service.jobs': 'Jobs & Career',
  'service.jobs.short': 'Jobs',
  'service.jobs.text': 'CVs, job applications, career support',
  'service.education': 'Education',
  'service.education.short': 'Education',
  'service.education.text': 'KUCCPS, HELB, school forms and more',
  'service.documents': 'Documents',
  'service.documents.short': 'Documents',
  'service.documents.text': 'Passport photos, photos to PDF, shrink a photo',
  'service.print': 'Print & Scan',
  'service.print.short': 'Print',
  'service.print.text': 'Print, photocopy, scan, lamination',
  'service.business': 'Business Services',
  'service.business.short': 'Business',
  'service.business.text': 'Permits, tax, invoices, adverts and tenders',
  'service.travel': 'Travel & Visa',
  'service.travel.short': 'Travel',
  'service.travel.text': 'Visa rules, forms, letters and work abroad safety',
  'service.payments': 'Payments & Bills',
  'service.payments.short': 'Payments',
  'service.payments.text': 'Electricity, water, internet, school fees',
  'service.account': 'Your account',
  'service.account.short': 'Account',
  'service.account.text': 'Locker, My Details and sign-in',
  'help': 'Help',
  'step.of': 'Step {n} of {total}',
  'step.back': 'Back',
  'step.next': 'Next: {name}',
  'gov.step1': 'What you need',
  'gov.step2': 'Are you ready?',
  'gov.step3': 'Your details',
  'gov.step4': 'Pay',
  'gov.step5': 'Track',
  'trip.step1': 'Visa check',
  'trip.step2': 'Documents',
  'trip.step3': 'Visa form',
  'trip.step4': 'Letters',
  'trip.step5': 'Track',
  'job.step1': 'Advert',
  'job.step2': 'Match',
  'job.step3': 'CV & letter',
  'job.step4': 'Apply',
  'job.step5': 'Track',
  'task.ask': 'Ask about this task',
  'chat.title': 'Virtual Attendant',
  'chat.greeting': 'Habari! I’m your virtual attendant. Tell me what you need done, in Swahili or English.',
  'chat.placeholder': 'Type a message...',
  'chat.online': 'Online',
  'chat.sample': 'Online · sample replies',
  'chat.resting': 'Resting until tomorrow',
  'chat.listen': 'Read aloud',
  'chat.stop': 'Stop reading',
  'chat.mic': 'Talking to type is coming soon. For now, type your message and I’ll read my replies aloud.',
};

export type TextKey = keyof typeof en;
type Key = TextKey;

const sw: Record<Key, string> = {
  'tab.home': 'Nyumbani',
  'tab.services': 'Huduma',
  'tab.locker': 'Kabati',
  'greeting.morning': 'Habari za asubuhi',
  'greeting.afternoon': 'Habari za mchana',
  'greeting.evening': 'Habari za jioni',
  'home.subtitle': 'Ungependa nikusaidie na nini leo?',
  'home.placeholder': 'Niambie unachohitaji...',
  'home.goStraight': 'Nenda moja kwa moja',
  'home.examples': 'Mifano',
  'home.quickServices': 'Huduma za Haraka',
  'home.moreServices': 'Huduma zaidi',
  'home.bannerTitle': 'Kutoka mtandaoni hadi mkononi. Tuko nawe.',
  'home.bannerText': 'Kamilisha kazi za mtandaoni, chapisha nyaraka na zaidi, mahali pamoja.',
  'trust.secure': 'Salama na siri',
  'trust.secureText': 'Taarifa zako zinalindwa kila wakati',
  'trust.fast': 'Haraka na kuaminika',
  'trust.fastText': 'Kazi inaisha haraka',
  'trust.local': 'Msaada wa karibu',
  'trust.localText': 'Kwa Kiswahili na Kiingereza',
  'example.passport': 'Kuomba pasipoti',
  'example.cv': 'Nisaidie kuandika CV',
  'example.print': 'Kuchapisha nyaraka zangu',
  'example.job': 'Kutafuta kazi',
  'continue.title': 'Endelea ulipoachia',
  'continue.next': 'Inayofuata: {step}',
  'continue.started': 'Umeanza',
  'continue.trip': 'Safari ya {place}',
  'welcome.title': 'Karibu! Mimi ni mhudumu wako wa cyber',
  'welcome.point1': 'Niambie unachohitaji, kwa Kiswahili au Kiingereza, nami nitakupeleka mahali sahihi.',
  'welcome.point2': 'Weka maelezo yako mara moja kwenye Maelezo Yangu. Kila fomu na CV itajijaza.',
  'welcome.point3': 'Umekwama kwenye ukurasa wowote? Bonyeza Msaada juu nami nitakueleza.',
  'welcome.try': 'Jaribu moja:',
  'welcome.done': 'Nimeelewa',
  'welcome.kra': 'Kupata KRA PIN',
  'welcome.job': 'Kuomba kazi',
  'welcome.travel': 'Kusafiri nje',
  'welcome.print': 'Kuchapisha hati',
  'services.title': 'Huduma',
  'services.intro': 'Kila kitu cha cyber, kwenye simu yako.',
  'services.language': 'Lugha',
  'services.account': 'Akaunti yako',
  'service.government': 'Huduma za Serikali',
  'service.government.short': 'Serikali',
  'service.government.text': 'eCitizen, KRA, NTSA, pasipoti na zaidi',
  'service.jobs': 'Kazi na Ajira',
  'service.jobs.short': 'Kazi',
  'service.jobs.text': 'CV, maombi ya kazi, ushauri wa kazi',
  'service.education': 'Elimu',
  'service.education.short': 'Elimu',
  'service.education.text': 'KUCCPS, HELB, fomu za shule na zaidi',
  'service.documents': 'Nyaraka',
  'service.documents.short': 'Nyaraka',
  'service.documents.text': 'Picha za pasipoti, picha kuwa PDF, kupunguza picha',
  'service.print': 'Kuchapisha na Kuskani',
  'service.print.short': 'Chapisha',
  'service.print.text': 'Kuchapisha, fotokopi, kuskani, lamination',
  'service.business': 'Huduma za Biashara',
  'service.business.short': 'Biashara',
  'service.business.text': 'Leseni, kodi, ankara, matangazo na zabuni',
  'service.travel': 'Safari na Viza',
  'service.travel.short': 'Safari',
  'service.travel.text': 'Masharti ya viza, fomu, barua na usalama wa kazi nje',
  'service.payments': 'Malipo na Bili',
  'service.payments.short': 'Malipo',
  'service.payments.text': 'Umeme, maji, intaneti, karo ya shule',
  'service.account': 'Akaunti yako',
  'service.account.short': 'Akaunti',
  'service.account.text': 'Kabati, Maelezo Yangu na kuingia',
  'help': 'Msaada',
  'step.of': 'Hatua {n} kati ya {total}',
  'step.back': 'Rudi',
  'step.next': 'Inayofuata: {name}',
  'gov.step1': 'Unachohitaji',
  'gov.step2': 'Uko tayari?',
  'gov.step3': 'Maelezo yako',
  'gov.step4': 'Lipa',
  'gov.step5': 'Fuatilia',
  'trip.step1': 'Angalia viza',
  'trip.step2': 'Nyaraka',
  'trip.step3': 'Fomu ya viza',
  'trip.step4': 'Barua',
  'trip.step5': 'Fuatilia',
  'job.step1': 'Tangazo',
  'job.step2': 'Ulinganifu',
  'job.step3': 'CV na barua',
  'job.step4': 'Omba',
  'job.step5': 'Fuatilia',
  'task.ask': 'Uliza kuhusu kazi hii',
  'chat.title': 'Mhudumu wa Mtandaoni',
  'chat.greeting': 'Habari! Mimi ni mhudumu wako wa mtandaoni. Niambie unachohitaji, kwa Kiswahili au Kiingereza.',
  'chat.placeholder': 'Andika ujumbe...',
  'chat.online': 'Yupo',
  'chat.sample': 'Yupo · majibu ya mfano',
  'chat.resting': 'Anapumzika hadi kesho',
  'chat.listen': 'Nisomee',
  'chat.stop': 'Acha kusoma',
  'chat.mic': 'Kuongea badala ya kuandika kunakuja hivi karibuni. Kwa sasa andika ujumbe, nami nitakusomea majibu yangu.',
};

const dictionaries: Record<Language, Record<Key, string>> = { en, sw };
const STORAGE_KEY = 'vc-language';

export type Translate = (key: Key, vars?: Record<string, string | number>) => string;

export function translate(language: Language, key: Key, vars: Record<string, string | number> = {}) {
  const text = dictionaries[language][key] ?? en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

type LanguageState = { language: Language; setLanguage: (language: Language) => void; t: Translate };

const LanguageContext = createContext<LanguageState>({
  language: 'en',
  setLanguage: () => {},
  t: (key, vars) => translate('en', key, vars),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'en' || saved === 'sw') setLanguageState(saved);
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<LanguageState>(
    () => ({ language, setLanguage, t: (key, vars) => translate(language, key, vars) }),
    [language, setLanguage],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

// A service tile's title, short title and description, from its id in
// data/services.ts.
export function serviceText(t: Translate, id: string) {
  const key = (suffix: string) => `service.${id}${suffix}` as Key;
  return { title: t(key('')), short: t(key('.short')), description: t(key('.text')) };
}
