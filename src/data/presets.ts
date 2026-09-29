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

// Filled in from official sources only; see the note at the top.
export const officialPresets: Preset[] = [];

export const presets: Preset[] = [...officialPresets, ...generalPresets];

export function findPreset(id: string | undefined) {
  return presets.find((preset) => preset.id === id);
}
