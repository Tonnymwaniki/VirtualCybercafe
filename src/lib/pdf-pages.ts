// Counts the pages in a PDF by finding its page objects. Compressed PDFs can
// hide them; then it returns null and the user types the number.

const TYPE = [0x2f, 0x54, 0x79, 0x70, 0x65]; // "/Type"
const PAGE = [0x2f, 0x50, 0x61, 0x67, 0x65]; // "/Page"

function matchesAt(bytes: Uint8Array, at: number, pattern: number[]) {
  for (let i = 0; i < pattern.length; i++) if (bytes[at + i] !== pattern[i]) return false;
  return true;
}

export function countPdfPages(buffer: ArrayBuffer): number | null {
  const bytes = new Uint8Array(buffer);
  let pages = 0;
  for (let i = 0; i < bytes.length - 12; i++) {
    if (bytes[i] !== 0x2f || !matchesAt(bytes, i, TYPE)) continue;
    let j = i + TYPE.length;
    while (bytes[j] === 0x20 || bytes[j] === 0x0a || bytes[j] === 0x0d) j++;
    // "/Page" but not "/Pages"
    if (matchesAt(bytes, j, PAGE) && bytes[j + PAGE.length] !== 0x73) pages++;
  }
  return pages > 0 ? pages : null;
}
