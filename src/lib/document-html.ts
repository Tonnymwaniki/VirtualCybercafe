function escape(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// A plain A4 page for letters and other documents the attendant writes.
export function documentHtml(title: string, body: string) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((para) => `<p>${escape(para.trim())}</p>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escape(title)}</title><style>
  @page { size: A4; margin: 20mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #0F172A; font-size: 11.5pt; line-height: 1.5; }
  p { margin: 0 0 12px; white-space: pre-line; }
</style></head><body>${paragraphs}</body></html>`;
}
