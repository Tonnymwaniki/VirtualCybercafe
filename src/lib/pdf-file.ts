// Turns a document page into a real PDF file on the phone, so it can be kept
// in the Locker or sent to Print Hub. The web app can only open the browser's
// print dialog (see sharePdfFromHtml in lib/images.ts).

import * as Print from 'expo-print';
import { Platform } from 'react-native';

import { readBytes, uploadFile } from '@/lib/locker-store';
import { setPendingPrint } from '@/lib/print-store';

export const canMakePdfFile = Platform.OS !== 'web';

async function makePdf(html: string) {
  const { uri } = await Print.printToFileAsync({ html });
  return { uri, bytes: await readBytes(uri) };
}

export async function savePdfToLocker(userId: string, html: string, name: string) {
  const { uri, bytes } = await makePdf(html);
  await uploadFile(userId, { uri, name, mimeType: 'application/pdf', bytes: bytes.byteLength, category: 'Documents' });
}

// Hands the PDF to the Print screen; open /print next.
export async function sendPdfToPrint(html: string, name: string) {
  const { uri, bytes } = await makePdf(html);
  setPendingPrint({ name, mimeType: 'application/pdf', bytes, localUri: uri });
}
