// Free, instant routing: matches what someone types against the catalogue
// with plain keyword scoring, on the phone, with no AI call.

import { catalogue, routeWith, type CatalogueEntry } from '@/data/catalogue';
import type { ChatAction } from '@/lib/chat-types';
import { isSwahili } from '@/lib/swahili';

const stopWords = new Set([
  'the', 'and', 'for', 'with', 'from', 'your', 'you', 'can', 'help', 'need', 'want', 'how', 'get', 'make', 'my', 'me', 'a',
  'an', 'to', 'of', 'in', 'on', 'i', 'is', 'do', 'nataka', 'nisaidie', 'naomba', 'kupata', 'kufanya', 'na', 'ya', 'wa', 'la',
  'kwa', 'cha', 'za', 'yangu', 'please', 'services', 'service', 'more', 'one', 'new', 'what', 'que',
]);

function normalise(text: string) {
  return ` ${text.toLowerCase().replace(/[^a-z0-9&]+/g, ' ').trim()} `;
}

function words(text: string) {
  return normalise(text).trim().split(' ').filter((w) => w.length > 2 && !stopWords.has(w));
}

// Precomputed once: the phrases and words each entry answers to.
const index = catalogue
  .filter((entry) => !entry.hidden)
  .map((entry) => ({
    entry,
    phrases: [...new Set([entry.title, ...entry.keywords].map(normalise))].filter((p) => p.trim().length > 1),
    titleWords: words(entry.title),
    keywordWords: new Set(entry.keywords.flatMap(words)),
    descriptionWords: new Set(words(entry.description)),
  }));

export type IntentMatch = { entry: CatalogueEntry; score: number };

export function matchIntent(text: string, limit = 3): IntentMatch[] {
  const typed = normalise(text);
  if (typed.trim().length < 2) return [];
  const typedWords = words(text);
  const lastWord = typedWords.at(-1);
  const results = index.map(({ entry, phrases, titleWords, keywordWords, descriptionWords }) => {
    let score = 0;
    const covered = new Set<string>();
    // A whole keyword or title in what was typed counts most, more for
    // longer phrases ("nil return" beats "return").
    for (const phrase of phrases) {
      if (!typed.includes(phrase)) continue;
      const phraseWords = phrase.trim().split(' ');
      score += 2 + phraseWords.length * 2;
      phraseWords.forEach((w) => covered.add(w));
    }
    for (const word of typedWords) {
      if (covered.has(word)) continue;
      if (titleWords.includes(word)) score += 3;
      else if (keywordWords.has(word)) score += 2;
      else if (descriptionWords.has(word)) score += 1;
      // The word still being typed on Home: "passp" finds Passport.
      else if (word === lastWord && word.length >= 3 && [...titleWords, ...keywordWords].some((w) => w.startsWith(word))) {
        score += 2;
      }
    }
    return { entry, score };
  });
  return results
    .filter((r) => r.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const questionWords =
  /\?|\b(how|what|why|when|where|which|who|much|cost|fee|fees|price|deadline|explain|bei|gani|ngapi|vipi|lini|wapi|kwa nini|nini|je)\b/i;

// A short request with one clear match ("KRA PIN", "nataka visa") is
// answered on the phone with a button. Questions go to the attendant.
export function confidentIntent(text: string): CatalogueEntry | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.split(/\s+/).length > 6 || questionWords.test(trimmed)) return null;
  const [top, second] = matchIntent(trimmed, 2);
  if (!top || top.score < 4) return null;
  if (second && second.score > top.score * 0.7) return null;
  return top.entry;
}

export function openAction(entry: CatalogueEntry, params = {}, language = 'en'): ChatAction {
  return { type: 'open', label: `${language === 'sw' ? 'Fungua' : 'Open'} ${entry.title}`, route: routeWith(entry, params) };
}

// The reply the chat shows for a confident match, without calling the AI.
export function localReply(text: string, entry: CatalogueEntry, language = 'en'): { reply: string; actions: ChatAction[] } {
  const reply = isSwahili(text) || language === 'sw'
    ? `Sawa! Hii inafanyika kwenye ${entry.title}: ${entry.description}. Bonyeza hapa chini kuanza, au niulize swali lolote kuihusu.`
    : `You can do that in ${entry.title}: ${entry.description}. Tap below to start, or ask me anything about it.`;
  return { reply, actions: [openAction(entry, {}, language)] };
}
