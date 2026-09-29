// Upload rules ("presets") that the Workbench checks files against.
//
// An official preset is only added when the portal or its owner states the
// rule, with the link and the date someone last checked it. A wrong rule is
// worse than none, so values from blogs and cyber sites are left out.

export type FileType = 'jpg' | 'png' | 'pdf';

// Checks on what a photo shows, done by the AI (about one chat message).
export type PhotoCheck = 'face' | 'plainBackground' | 'whiteBackground' | 'noGlasses' | 'sharp';

export type Preset = {
  id: string;
  title: string;
  // Where it is used, e.g. "eCitizen passport application".
  where: string;
  // Accepted types; the first is what "Fix it" makes when converting.
  types: FileType[];
  maxKB?: number;
  minKB?: number;
  // Exact size in pixels.
  width?: number;
  height?: number;
  // Shortest side at least this many pixels.
  minWidth?: number;
  maxPages?: number;
  photo?: PhotoCheck[];
  // Official presets only.
  source?: { url: string; label: string };
  lastChecked?: string;
  // Anything else the rule says, in plain words.
  note?: string;
};

// Limits people are commonly asked for. Not tied to one portal.
export const generalPresets: Preset[] = [
  { id: 'pdf_1mb', title: 'PDF under 1 MB', where: 'Any form that asks for a PDF up to 1 MB', types: ['pdf'], maxKB: 1024 },
  { id: 'pdf_2mb', title: 'PDF under 2 MB', where: 'Any form that asks for a PDF up to 2 MB', types: ['pdf'], maxKB: 2048 },
  { id: 'pdf_500kb', title: 'PDF under 500 KB', where: 'Any form that asks for a PDF up to 500 KB', types: ['pdf'], maxKB: 500 },
  { id: 'jpg_200kb', title: 'JPG under 200 KB', where: 'Any form that asks for a photo up to 200 KB', types: ['jpg'], maxKB: 200 },
  { id: 'jpg_500kb', title: 'JPG under 500 KB', where: 'Any form that asks for a photo up to 500 KB', types: ['jpg'], maxKB: 500 },
  {
    id: 'photo_600',
    title: 'Photo 600 × 600 under 200 KB',
    where: 'Passport-style photo for forms that ask for 600 × 600',
    types: ['jpg'],
    maxKB: 200,
    width: 600,
    height: 600,
    photo: ['face', 'plainBackground', 'noGlasses', 'sharp'],
  },
];

// From official sources only; see the note at the top. None of these
// portals publishes a size limit in KB or pixels, so only the file type and
// photo rules are checked. Checked on 29 Sep 2026.
export const officialPresets: Preset[] = [
  {
    id: 'ecitizen_passport_photo',
    title: 'eCitizen passport photo',
    where: 'Kenyan passport application on eCitizen',
    types: ['jpg', 'png'],
    photo: ['face', 'whiteBackground', 'noGlasses', 'sharp'],
    note: 'Colour, white background, full face with both ears showing, no glasses, earrings or headbands, not smiling, taken within the last month. Print size 2 × 2 inches.',
    source: { url: 'https://kenyaembassydc.org/epassport/', label: 'Kenya Embassy, Washington DC: e-passport guide' },
    lastChecked: '2026-09-29',
  },
  {
    id: 'ecitizen_passport_docs',
    title: 'eCitizen passport documents',
    where: 'ID, birth certificate or old passport page for a passport application',
    types: ['jpg', 'png'],
    note: 'Upload pictures (JPG or PNG), not PDF or Word. The embassy guide suggests saving each one at about 150 KB.',
    source: { url: 'https://kenyaembassydc.org/epassport/', label: 'Kenya Embassy, Washington DC: e-passport guide' },
    lastChecked: '2026-09-29',
  },
  {
    id: 'hef_photo',
    title: 'HEF / HELB photo',
    where: 'Passport-size photo for the HEF student funding application',
    types: ['jpg', 'png'],
    photo: ['face', 'plainBackground', 'sharp'],
    source: { url: 'https://www.hef.co.ke/', label: 'Higher Education Financing (hef.co.ke)' },
    lastChecked: '2026-09-29',
  },
  {
    id: 'hef_docs',
    title: 'HEF / HELB documents',
    where: 'ID or Maisha Card, birth certificate (minors), death certificate, sponsorship letter',
    types: ['pdf'],
    note: 'Put both sides of the ID in one PDF (use Scan a document or Photos to PDF).',
    source: { url: 'https://www.hef.co.ke/', label: 'Higher Education Financing (hef.co.ke)' },
    lastChecked: '2026-09-29',
  },
  {
    id: 'karu_admission_photo',
    title: 'Karatina University admission photo',
    where: 'First-year joining (KUCCPS placement) at Karatina University',
    types: ['jpg'],
    photo: ['face', 'whiteBackground', 'sharp'],
    note: 'A coloured passport photo on a white background, in JPEG. Other universities may differ.',
    source: { url: 'https://karu.ac.ke/admission-letters-portal/', label: 'Karatina University admission portal' },
    lastChecked: '2026-09-29',
  },
  {
    id: 'karu_admission_docs',
    title: 'Karatina University admission documents',
    where: 'ID or birth certificate, KCSE result slip and admission forms',
    types: ['pdf'],
    note: 'Other universities may differ.',
    source: { url: 'https://karu.ac.ke/admission-letters-portal/', label: 'Karatina University admission portal' },
    lastChecked: '2026-09-29',
  },
];

export const presets: Preset[] = [...officialPresets, ...generalPresets];

export function findPreset(id: string | undefined) {
  return presets.find((preset) => preset.id === id);
}
