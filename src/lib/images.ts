import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  bytes: number | null;
};

export type ProcessedImage = {
  uri: string;
  base64: string;
  width: number;
  height: number;
  bytes: number;
  quality: number;
};

export const canUseCamera = Platform.OS !== 'web';

async function fileSize(uri: string, known?: number | null) {
  if (known) return known;
  try {
    const blob = await (await fetch(uri)).blob();
    return blob.size;
  } catch {
    return null;
  }
}

// Opens the camera or the photo library. Returns [] if the user cancels or
// refuses permission.
export async function pickImages(
  source: 'camera' | 'library',
  multiple = false,
): Promise<PickedImage[]> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: multiple,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return [];
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled) return [];
  return Promise.all(
    result.assets.map(async (asset) => ({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      bytes: await fileSize(asset.uri, asset.fileSize),
    })),
  );
}

export function bytesFromBase64(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function formatBytes(bytes: number | null) {
  if (bytes == null) return 'unknown size';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ProcessOptions = {
  // Crop the centre of the image to a square before resizing.
  square?: boolean;
  // Longest side (or exact side when square) in pixels.
  maxSide: number;
  // Lower JPEG quality step by step until the file is at most this many bytes.
  maxBytes?: number;
};

export async function processImage(image: PickedImage, options: ProcessOptions): Promise<ProcessedImage> {
  let context = ImageManipulator.manipulate(image.uri);
  let width = image.width;
  let height = image.height;

  if (options.square) {
    const side = Math.min(width, height);
    context = context.crop({
      originX: Math.floor((width - side) / 2),
      originY: Math.floor((height - side) / 2),
      width: side,
      height: side,
    });
    width = height = side;
  }

  const scale = Math.min(1, options.maxSide / Math.max(width, height));
  if (options.square) {
    context = context.resize({ width: options.maxSide, height: options.maxSide });
  } else if (scale < 1) {
    context = context.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
  }

  const rendered = await context.renderAsync();
  let quality = 0.9;
  let saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
  while (options.maxBytes && bytesFromBase64(saved.base64 ?? '') > options.maxBytes && quality > 0.2) {
    quality = Math.round((quality - 0.1) * 10) / 10;
    saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
  }

  const base64 = saved.base64 ?? '';
  return {
    uri: saved.uri,
    base64,
    width: saved.width,
    height: saved.height,
    bytes: bytesFromBase64(base64),
    quality,
  };
}

// Shares (phone) or downloads (web) a processed JPEG.
export async function shareImage(image: ProcessedImage, fileName: string) {
  if (Platform.OS === 'web') {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${image.base64}`;
    link.download = fileName;
    link.click();
    return;
  }
  await Sharing.shareAsync(image.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
}

// Builds a PDF with one image per A4 page, then shares it (phone) or opens
// the browser's print dialog where it can be saved as PDF (web).
export async function sharePdfFromImages(images: ProcessedImage[]) {
  const pages = images
    .map(
      (image) =>
        `<div class="page"><img src="data:image/jpeg;base64,${image.base64}" /></div>`,
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 12mm; }
  body { margin: 0; }
  .page { height: 270mm; display: flex; align-items: center; justify-content: center; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
</style></head><body>${pages}</body></html>`;

  await sharePdfFromHtml(html);
}

// Turns an HTML page into a PDF and shares it (phone), or opens the browser's
// print dialog where it can be saved as PDF (web).
export async function sharePdfFromHtml(html: string) {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
