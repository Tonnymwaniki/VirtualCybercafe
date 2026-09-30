// Photo tools for the Workbench: resize, rotate, crop and shrink to a size
// limit. They run on the phone with expo-image-manipulator, so they are free
// and work without a connection.

import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

import type { PickedImage } from '@/lib/images';
import { readBytes } from '@/lib/locker-store';
import { fileUri, fromBase64, renamed, type WorkFile } from '@/lib/workbench/files';

export type ImageFormat = 'jpg' | 'png';

export async function imageFromPicked(picked: PickedImage): Promise<WorkFile> {
  const bytes = new Uint8Array(await readBytes(picked.uri));
  const name = picked.fileName ?? `photo-${Date.now()}.jpg`;
  return { name, kind: 'image', mimeType: /\.png$/i.test(name) ? 'image/png' : 'image/jpeg', bytes, uri: picked.uri, width: picked.width, height: picked.height };
}

// The picture's size in pixels, read once and remembered on the file.
export async function imageSize(file: WorkFile) {
  if (!file.width || !file.height) {
    const ref = await ImageManipulator.manipulate(fileUri(file)).renderAsync();
    file.width = ref.width;
    file.height = ref.height;
  }
  return { width: file.width, height: file.height };
}

async function encode(ref: ImageRef, name: string, format: ImageFormat, quality: number): Promise<WorkFile> {
  const saved = await ref.saveAsync({ format: format === 'png' ? SaveFormat.PNG : SaveFormat.JPEG, compress: quality, base64: true });
  return {
    name,
    kind: 'image',
    mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
    bytes: fromBase64(saved.base64 ?? ''),
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
  };
}

type Edit = {
  rotate?: number;
  // In the picture's own pixels, after rotating.
  crop?: { originX: number; originY: number; width: number; height: number };
  // Longest side, keeping the shape.
  maxSide?: number;
  // Exact size: the centre is cropped to this shape first.
  exact?: { width: number; height: number };
};

async function render(file: WorkFile, edit: Edit) {
  let { width, height } = await imageSize(file);
  let context = ImageManipulator.manipulate(fileUri(file));
  if (edit.rotate) {
    context = context.rotate(edit.rotate);
    if (Math.abs(edit.rotate) % 180 === 90) [width, height] = [height, width];
  }
  if (edit.crop) {
    context = context.crop(edit.crop);
    ({ width, height } = edit.crop);
  }
  if (edit.exact) {
    const target = edit.exact.width / edit.exact.height;
    const cropWidth = Math.min(width, Math.round(height * target));
    const cropHeight = Math.min(height, Math.round(width / target));
    context = context
      .crop({ originX: Math.floor((width - cropWidth) / 2), originY: Math.floor((height - cropHeight) / 2), width: cropWidth, height: cropHeight })
      .resize({ width: edit.exact.width, height: edit.exact.height });
  } else if (edit.maxSide && Math.max(width, height) > edit.maxSide) {
    const scale = edit.maxSide / Math.max(width, height);
    context = context.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
  }
  return context.renderAsync();
}

export async function editImage(file: WorkFile, edit: Edit, format: ImageFormat = 'jpg', quality = 0.92) {
  const ref = await render(file, edit);
  return encode(ref, renamed(file.name, '-edited', format), format, quality);
}

export type ShrinkResult = { file: WorkFile; reached: boolean };

// Makes a JPEG at most maxBytes, keeping as many pixels and as much quality
// as fit. It lowers quality first, then the size in pixels, and stops at a
// point where text would stop being readable.
export async function shrinkImage(
  file: WorkFile,
  maxBytes: number,
  options: { exact?: { width: number; height: number }; maxSide?: number } = {},
): Promise<ShrinkResult> {
  const { width, height } = await imageSize(file);
  const longest = Math.max(width, height);
  const sides = options.exact
    ? [0]
    : [Math.min(longest, options.maxSide ?? 3000), 2400, 2000, 1600, 1280, 1024, 800, 640].filter(
        (side, i, all) => side <= Math.min(longest, options.maxSide ?? 3000) && all.indexOf(side) === i,
      );
  if (!sides.length) sides.push(longest);
  const name = renamed(file.name, '-small', 'jpg');
  let smallest: WorkFile | null = null;

  for (const side of sides) {
    const ref = await render(file, options.exact ? { exact: options.exact } : { maxSide: side });
    // Best quality first: often nothing needs to change.
    const top = await encode(ref, name, 'jpg', 0.92);
    if (top.bytes.byteLength <= maxBytes) return { file: top, reached: true };
    // Find the highest quality that fits, between 0.4 and 0.92.
    let low = 0.4;
    let high = 0.92;
    let best: WorkFile | null = null;
    const floor = await encode(ref, name, 'jpg', low);
    if (!smallest || floor.bytes.byteLength < smallest.bytes.byteLength) smallest = floor;
    if (floor.bytes.byteLength <= maxBytes) {
      best = floor;
      for (let i = 0; i < 5; i++) {
        const mid = (low + high) / 2;
        const trial = await encode(ref, name, 'jpg', mid);
        if (trial.bytes.byteLength <= maxBytes) {
          best = trial;
          low = mid;
        } else {
          high = mid;
        }
      }
      return { file: best, reached: true };
    }
  }
  // Even the smallest readable version is too big.
  return { file: smallest ?? file, reached: false };
}
