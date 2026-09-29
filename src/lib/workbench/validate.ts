// Checks a file against an upload rule (a preset) and fixes what it can:
// the type, the pixel size, the file size and the page count. Every tick is
// measured on the real file; nothing is guessed.

import type { useEngine } from '@/components/workbench/engine';
import type { FileType, Preset } from '@/data/presets';
import { formatSize, renamed, size, type WorkFile } from '@/lib/workbench/files';
import { editImage, imageSize, shrinkImage } from '@/lib/workbench/image';
import { joinFiles, pageCount } from '@/lib/workbench/pdf';
import { shrinkPdf } from '@/lib/workbench/shrink-pdf';
import { track } from '@/lib/stats';

export type RuleCheck = { ok: boolean; label: string };

export function typeOf(file: WorkFile): FileType {
  if (file.kind === 'pdf') return 'pdf';
  return file.mimeType === 'image/png' ? 'png' : 'jpg';
}

const TYPE_NAMES: Record<FileType, string> = { jpg: 'JPG', png: 'PNG', pdf: 'PDF' };

export function typesLabel(types: FileType[]) {
  return types.map((t) => TYPE_NAMES[t]).join(' or ');
}

export async function checkAgainst(file: WorkFile, preset: Preset): Promise<RuleCheck[]> {
  const checks: RuleCheck[] = [];
  const type = typeOf(file);
  checks.push({ ok: preset.types.includes(type), label: `${TYPE_NAMES[type]}${preset.types.includes(type) ? '' : ` (needs ${typesLabel(preset.types)})`}` });

  const bytes = size(file);
  if (preset.maxKB) {
    const ok = bytes <= preset.maxKB * 1024;
    checks.push({ ok, label: `${formatSize(bytes)} (limit ${formatSize(preset.maxKB * 1024)})` });
  } else {
    checks.push({ ok: true, label: formatSize(bytes) });
  }
  if (preset.minKB && bytes < preset.minKB * 1024) {
    checks.push({ ok: false, label: `Smaller than ${formatSize(preset.minKB * 1024)}; the site may reject it` });
  }

  if (file.kind === 'image' && (preset.width || preset.minWidth)) {
    const { width, height } = await imageSize(file);
    if (preset.width && preset.height) {
      const ok = width === preset.width && height === preset.height;
      checks.push({ ok, label: `${width} × ${height}${ok ? '' : ` (needs ${preset.width} × ${preset.height})`}` });
    } else if (preset.minWidth) {
      const ok = Math.min(width, height) >= preset.minWidth;
      checks.push({ ok, label: `${width} × ${height}${ok ? '' : ` (needs at least ${preset.minWidth} px)`}` });
    }
  }

  if (file.kind === 'pdf') {
    const pages = await pageCount(file);
    if (preset.maxPages) {
      const ok = pages <= preset.maxPages;
      checks.push({ ok, label: `${pages} page${pages === 1 ? '' : 's'}${ok ? '' : ` (at most ${preset.maxPages})`}` });
    } else {
      checks.push({ ok: true, label: `${pages} page${pages === 1 ? '' : 's'}` });
    }
  }
  return checks;
}

export type FixResult = { file: WorkFile; notes: string[] };

// Makes the file meet the rule where the phone can: converts the type,
// resizes, shrinks and turns photos into a PDF. Page limits and what the
// photo shows are left to the person.
export async function fixToRule(file: WorkFile, preset: Preset, engine: ReturnType<typeof useEngine>): Promise<FixResult> {
  track('workbench.fix_rule');
  const notes: string[] = [];
  const current = typeOf(file);
  const target: FileType = preset.types.includes(current) ? current : preset.types[0];
  const maxBytes = preset.maxKB ? preset.maxKB * 1024 : undefined;
  const exact = preset.width && preset.height ? { width: preset.width, height: preset.height } : undefined;

  let source = file;
  if (target !== 'pdf' && file.kind === 'pdf') {
    const pages = await pageCount(file);
    [source] = await engine.renderPdf(file, { pages: [0], scale: 3, maxSide: 3000, quality: 0.92 });
    if (pages > 1) notes.push(`Only page 1 of ${pages} was used. Use PDF to JPG for the other pages.`);
  }

  if (target === 'pdf') {
    let out = source.kind === 'pdf' ? source : await joinFiles([source], renamed(file.name, '', 'pdf'));
    if (maxBytes && out.bytes.byteLength > maxBytes) {
      const shrunk = await shrinkPdf(out, maxBytes, engine);
      out = shrunk.file;
      if (shrunk.asPictures) notes.push('Pages are now pictures, so text can’t be selected. Check it is easy to read.');
    }
    const pages = await pageCount(out);
    if (preset.maxPages && pages > preset.maxPages) {
      notes.push(`It has ${pages} pages but the limit is ${preset.maxPages}. Use Pick or split pages to keep only what’s needed.`);
    }
    return { file: { ...out, name: renamed(file.name, `-${preset.id}`, 'pdf') }, notes };
  }

  // A photo in the end.
  let out: WorkFile;
  if (target === 'png' && !maxBytes) {
    out = await editImage(source, exact ? { exact } : {}, 'png');
  } else {
    const shrunk = await shrinkImage(source, maxBytes ?? 20 * 1024 * 1024, exact ? { exact } : {});
    out = shrunk.file;
    if (target === 'png') notes.push('Saved as JPG, because a PNG can’t be made that small. Most sites that take PNG also take JPG; check the form.');
  }
  if (exact) notes.push(`Cropped from the centre to ${exact.width} × ${exact.height}. Check nothing important was cut off.`);
  if (preset.minWidth && Math.min(out.width ?? 0, out.height ?? 0) < preset.minWidth) {
    notes.push(`The photo is smaller than ${preset.minWidth} px on one side. Take a sharper photo if the site rejects it.`);
  }
  return { file: { ...out, name: renamed(file.name, `-${preset.id}`, out.mimeType === 'image/png' ? 'png' : 'jpg') }, notes };
}
