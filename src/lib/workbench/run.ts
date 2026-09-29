// Runs a Workbench request from the chat on the phone, and measures the
// result. The AI only chose the operation and settings; every number on the
// result card comes from the real file.

import type { useEngine } from '@/components/workbench/engine';
import { checksFor } from '@/components/workbench/ui';
import { findPreset } from '@/data/presets';
import { fileById, keepFile } from '@/lib/chat-files';
import type { WorkOutcome, WorkRequest } from '@/lib/chat-types';
import { renamed, type WorkFile } from '@/lib/workbench/files';
import { editImage, shrinkImage } from '@/lib/workbench/image';
import { joinFiles, keepPages, pageCount, parsePages, WorkbenchError } from '@/lib/workbench/pdf';
import { digitalPassport, PASSPORT_MAX_BYTES, PASSPORT_SIDE, passportSheet, printSizes } from '@/lib/workbench/passport';
import { shrinkPdf } from '@/lib/workbench/shrink-pdf';
import { checkAgainst, fixToRule } from '@/lib/workbench/validate';

type Engine = ReturnType<typeof useEngine>;
type Output = { file: WorkFile; checks: { ok: boolean; label: string }[] };

function inputs(request: WorkRequest) {
  const found = request.fileIds.map(fileById).filter((f): f is WorkFile => !!f);
  if (!found.length) throw new WorkbenchError('The file isn’t on this phone any more. Send it again.');
  return found;
}

async function run(request: WorkRequest, engine: Engine): Promise<{ outputs: Output[]; notes: string[] }> {
  const files = inputs(request);
  const notes: string[] = [];
  const outputs: Output[] = [];

  switch (request.op) {
    case 'shrink': {
      const maxBytes = request.maxKB * 1024;
      for (const file of files) {
        if (file.kind === 'image') {
          const result = await shrinkImage(file, maxBytes);
          if (!result.reached) notes.push(`${file.name} can’t go that small and stay readable.`);
          outputs.push({ file: result.file, checks: checksFor(result.file, { maxBytes }) });
        } else {
          const result = await shrinkPdf(file, maxBytes, engine);
          if (result.asPictures) notes.push('The pages are now pictures, so text can’t be selected. Check it is easy to read.');
          if (!result.reached) notes.push(`${file.name} can’t go that small and stay readable.`);
          outputs.push({ file: result.file, checks: checksFor(result.file, { maxBytes }) });
        }
      }
      break;
    }
    case 'resize': {
      const maxBytes = request.maxKB ? request.maxKB * 1024 : undefined;
      for (const file of files) {
        if (file.kind !== 'image') throw new WorkbenchError('Resizing works on photos. Turn the PDF into a JPG first.');
        const edit = request.exact ? { exact: { width: request.width, height: request.height } } : { maxSide: Math.max(request.width, request.height) };
        const out = maxBytes ? (await shrinkImage(file, maxBytes, edit)).file : await editImage(file, edit);
        outputs.push({ file: out, checks: checksFor(out, { maxBytes, ...(request.exact ? { width: request.width, height: request.height } : {}) }) });
      }
      if (request.exact) notes.push('Cropped from the centre. Check nothing important was cut off.');
      break;
    }
    case 'to_pdf': {
      let out = await joinFiles(files, files.length === 1 ? renamed(files[0].name, '', 'pdf') : 'joined.pdf');
      const maxBytes = request.maxKB ? request.maxKB * 1024 : undefined;
      if (maxBytes && out.bytes.byteLength > maxBytes) {
        const result = await shrinkPdf(out, maxBytes, engine);
        out = result.file;
        if (!result.reached) notes.push('It can’t go that small and stay readable.');
      }
      outputs.push({ file: out, checks: checksFor(out, { maxBytes }) });
      break;
    }
    case 'pick_pages': {
      const [file] = files;
      if (file.kind !== 'pdf') throw new WorkbenchError('Picking pages works on a PDF.');
      const pages = parsePages(request.pages, await pageCount(file));
      if (typeof pages === 'string') throw new WorkbenchError(pages);
      const out = await keepPages(file, pages);
      outputs.push({ file: out, checks: checksFor(out) });
      break;
    }
    case 'to_jpg': {
      for (const file of files) {
        if (file.kind === 'image') {
          const out = await editImage(file, {}, 'jpg');
          outputs.push({ file: { ...out, name: renamed(file.name, '', 'jpg') }, checks: checksFor(out) });
          continue;
        }
        const pages = request.pages ? parsePages(request.pages, await pageCount(file)) : undefined;
        if (typeof pages === 'string') throw new WorkbenchError(pages);
        const pictures = await engine.renderPdf(file, { pages, scale: 2, maxSide: 2000, quality: 0.85 });
        pictures.forEach((picture) => outputs.push({ file: picture, checks: checksFor(picture) }));
      }
      break;
    }
    case 'check_rule': {
      const preset = findPreset(request.ruleId);
      if (!preset) throw new WorkbenchError('That upload rule isn’t in the app.');
      for (const file of files) {
        const before = await checkAgainst(file, preset);
        if (before.every((c) => c.ok)) {
          notes.push(`${file.name} already meets the ${preset.title} rule.`);
          outputs.push({ file, checks: before });
          continue;
        }
        const fixed = await fixToRule(file, preset, engine);
        notes.push(...fixed.notes);
        outputs.push({ file: fixed.file, checks: await checkAgainst(fixed.file, preset) });
      }
      if (preset.source) notes.push(`Rule from ${preset.source.label}.`);
      break;
    }
    case 'passport': {
      const [file] = files;
      if (file.kind !== 'image') throw new WorkbenchError('A passport photo needs a photo of your face, not a PDF.');
      const digital = await digitalPassport(file);
      outputs.push({
        file: digital.file,
        checks: [
          ...checksFor(digital.file, { maxBytes: PASSPORT_MAX_BYTES, width: PASSPORT_SIDE, height: PASSPORT_SIDE }),
          ...(digital.sharpEnough ? [] : [{ ok: false, label: 'The original photo is small; take a closer, sharper one' }]),
        ],
      });
      const spec = printSizes[request.printSize];
      const sheet = await passportSheet(file, request.printSize);
      outputs.push({ file: sheet, checks: [{ ok: true, label: 'A4 PDF, 1 page' }, { ok: true, label: `${spec.rows * spec.columns} photos at ${spec.label}` }] });
      notes.push('The photo is only cropped and resized, never edited. Check nothing was cut off. Print the sheet at actual size (100%), not “fit to page”.');
      break;
    }
    case 'scan': {
      const cleaned: WorkFile[] = [];
      for (const file of files) {
        if (file.kind !== 'image') throw new WorkbenchError('Scanning works on photos of pages.');
        const page = await editImage(file, { maxSide: 2200 }, 'jpg', 0.9);
        cleaned.push(await engine.filterImage(page, request.look));
      }
      const out = await joinFiles(cleaned, 'scan.pdf');
      outputs.push({ file: out, checks: checksFor(out) });
      break;
    }
  }
  return { outputs, notes };
}

export async function runWork(request: WorkRequest, engine: Engine): Promise<WorkOutcome> {
  try {
    const { outputs, notes } = await run(request, engine);
    return {
      status: 'done',
      outputs: outputs.map(({ file, checks }) => ({ file: keepFile(file), checks })),
      notes,
    };
  } catch (error) {
    return {
      status: 'failed',
      outputs: [],
      notes: [],
      error: error instanceof WorkbenchError || (error instanceof Error && /internet|password/.test(error.message)) ? error.message : 'That didn’t work. Try again, or use the Workbench screen.',
    };
  }
}
