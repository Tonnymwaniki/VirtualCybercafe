// The application pack: cover letter, CV and certificate photos in one PDF.

import { cvHtml, letterHtml, type CvAnswers, type CvDesign, type CvDocument } from '@/lib/cv';

function body(html: string) {
  return html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
}

function style(html: string) {
  return html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
}

export function packHtml(cv: CvDocument, answers: CvAnswers, images: { name: string; dataUrl: string }[], design: CvDesign = 'blue') {
  const letter = letterHtml(cv, answers, design);
  const resume = cvHtml(cv, answers, design);
  const pages = images
    .map(
      (image) =>
        `<div class="break attachment"><div class="muted">${image.name.replace(/[<>&"]/g, '')}</div><img src="${image.dataUrl}" /></div>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8" /><style>${style(resume)}
  .break { page-break-before: always; }
  .attachment { text-align: center; padding: ${design === 'modern' ? '14mm' : '0'}; }
  .attachment img { max-width: 100%; max-height: 250mm; object-fit: contain; margin-top: 6px; }
</style></head><body>
${body(letter)}
<div class="break">${body(resume)}</div>
${pages}
</body></html>`;
}
