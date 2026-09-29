// The page that runs inside the Workbench's hidden web view (phone) or
// hidden frame (web). It draws PDF pages with pdf.js and cleans up scans on
// a canvas, then posts the pictures back. pdf.js loads from cdnjs the first
// time; on phones the app then keeps a copy (pdfjs-cache.ts) and hands it in
// as window.__pdfCode, so reading PDF pages works offline after that.

export const PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

const script = `
const PDFJS = '${PDFJS_BASE}';
function send(message) {
  const text = JSON.stringify(message);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
  else parent.postMessage(text, '*');
}
let library = null;
function pdfjs() {
  if (!library) {
    library = new Promise((resolve, reject) => {
      const kept = window.__pdfCode;
      if (kept) {
        try {
          const tag = document.createElement('script');
          tag.textContent = kept.main;
          document.head.appendChild(tag);
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([kept.worker], { type: 'text/javascript' }));
          resolve(window.pdfjsLib);
          return;
        } catch (error) {
          window.__pdfCode = null;
        }
      }
      const tag = document.createElement('script');
      tag.src = PDFJS + 'pdf.min.js';
      tag.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
        send({ type: 'pdfjs-from-web' });
        resolve(window.pdfjsLib);
      };
      tag.onerror = () => {
        library = null;
        reject(new Error('offline'));
      };
      document.head.appendChild(tag);
    });
  }
  return library;
}
function toBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function jpeg(canvas, quality) {
  return canvas.toDataURL('image/jpeg', quality).split(',')[1];
}

async function renderPdf(request) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: toBytes(request.data), isEvalSupported: false }).promise;
  send({ id: request.id, type: 'info', pages: doc.numPages });
  const wanted = request.pages && request.pages.length ? request.pages : Array.from({ length: doc.numPages }, (_, i) => i);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  for (const index of wanted) {
    const page = await doc.getPage(index + 1);
    const natural = page.getViewport({ scale: 1 });
    let scale = request.scale || 2;
    if (request.maxSide) scale = Math.min(scale, request.maxSide / Math.max(natural.width, natural.height));
    const viewport = page.getViewport({ scale });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    send({ id: request.id, type: 'page', index, width: canvas.width, height: canvas.height, data: jpeg(canvas, request.quality || 0.85) });
    page.cleanup();
  }
  doc.destroy();
  send({ id: request.id, type: 'done' });
}

function loadImage(request) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That picture could not be read.'));
    image.src = 'data:' + request.mimeType + ';base64,' + request.data;
  });
}

// Levels: stretch so the darkest 1% becomes black and the lightest 1% white.
function levels(values) {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < values.length; i++) histogram[values[i]]++;
  const cut = values.length * 0.01;
  let low = 0, high = 255, sum = 0;
  while (low < 255 && (sum += histogram[low]) < cut) low++;
  sum = 0;
  while (high > 0 && (sum += histogram[high]) < cut) high--;
  if (high - low < 20) return (v) => v;
  return (v) => Math.max(0, Math.min(255, Math.round(((v - low) * 255) / (high - low))));
}

// Average brightness around each pixel, from a summed-area table.
function localMean(gray, width, height, radius) {
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x];
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
    }
  }
  const mean = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(width - 1, x + radius);
      const total = integral[(y1 + 1) * (width + 1) + x1 + 1] - integral[y0 * (width + 1) + x1 + 1]
        - integral[(y1 + 1) * (width + 1) + x0] + integral[y0 * (width + 1) + x0];
      mean[y * width + x] = total / ((x1 - x0 + 1) * (y1 - y0 + 1));
    }
  }
  return mean;
}

async function filterImage(request) {
  const image = await loadImage(request);
  const scale = Math.min(1, (request.maxSide || 2400) / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale), height = Math.round(image.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const count = width * height;
  const gray = new Uint8ClampedArray(count);
  for (let i = 0; i < count; i++) gray[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];

  if (request.mode === 'enhance') {
    const map = levels(gray);
    for (let i = 0; i < count * 4; i++) if (i % 4 !== 3) pixels[i] = map(pixels[i]);
  } else {
    // Divide by the local background to lift shadows and make paper white.
    const mean = localMean(gray, width, height, Math.max(8, Math.round(Math.max(width, height) / 24)));
    const out = new Uint8ClampedArray(count);
    for (let i = 0; i < count; i++) {
      const value = mean[i] > 0 ? (gray[i] / mean[i]) * 245 : 255;
      // Black only where clearly darker than the paper around it, so grain stays white.
      out[i] = request.mode === 'bw' ? (gray[i] < mean[i] - Math.max(28, mean[i] * 0.18) ? 0 : 255) : value;
    }
    const map = request.mode === 'bw' ? (v) => v : levels(out);
    for (let i = 0; i < count; i++) {
      const v = map(out[i]);
      pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = v;
    }
  }
  context.putImageData(frame, 0, 0);
  send({ id: request.id, type: 'image', width, height, data: jpeg(canvas, request.quality || 0.82) });
}

window.__run = (request) => {
  const job = request.type === 'pdf' ? renderPdf(request) : filterImage(request);
  job.catch((error) => send({ id: request.id, type: 'error', message: String((error && error.message) || error) }));
};
window.addEventListener('message', (event) => {
  if (typeof event.data !== 'string' || event.data[0] !== '{') return;
  try { window.__run(JSON.parse(event.data)); } catch (e) {}
});
send({ type: 'ready' });
`;

export const ENGINE_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${script}</script></body></html>`;
