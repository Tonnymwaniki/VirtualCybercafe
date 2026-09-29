// Guesses whether a message is in Swahili, to answer in the same language.

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

export function isSwahili(text: string) {
  const words = text.toLowerCase().split(/[^a-z']+/);
  return words.some((word) => swahiliWords.includes(word));
}
