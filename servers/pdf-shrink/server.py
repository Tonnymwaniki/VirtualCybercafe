"""PDF shrinking server for Virtual Cybercafe.

One job: make a PDF smaller with Ghostscript, keeping text as text.
POST /shrink with the PDF as the body, header X-Key: <PDF_SERVER_KEY>, and
optional ?target=<bytes>. It tries "ebook" (150 dpi pictures) and then
"screen" (72 dpi), and returns the first result under the target, or the
smallest. Files live in a temporary folder only while the request runs and
are deleted straight after. Nothing is logged but sizes and timings.
"""

import hmac
import os
import subprocess
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

KEY = os.environ.get("PDF_SERVER_KEY", "")
MAX_BYTES = int(os.environ.get("PDF_MAX_BYTES", str(25 * 1024 * 1024)))
LEVELS = ["ebook", "screen"]
TIMEOUT_S = 90


def ghostscript(source: str, target: str, level: str) -> bool:
    command = [
        "gs", "-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.5", f"-dPDFSETTINGS=/{level}",
        "-dDetectDuplicateImages=true", "-dCompressFonts=true",
        f"-sOutputFile={target}", source,
    ]
    try:
        subprocess.run(command, check=True, timeout=TIMEOUT_S, capture_output=True)
        return os.path.getsize(target) > 0
    except (subprocess.SubprocessError, OSError):
        return False


class Handler(BaseHTTPRequestHandler):
    server_version = "pdf-shrink"

    def reply(self, status: int, body: bytes = b"", kind: str = "text/plain", headers: dict | None = None):
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlparse(self.path).path == "/health":
            return self.reply(200, b"ok")
        self.reply(404, b"not found")

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/shrink":
            return self.reply(404, b"not found")
        if not KEY or not hmac.compare_digest(self.headers.get("X-Key", ""), KEY):
            return self.reply(401, b"wrong key")
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BYTES:
            return self.reply(413, b"file too large")
        data = self.rfile.read(length)
        if not data.startswith(b"%PDF"):
            return self.reply(415, b"not a PDF")
        target = int((parse_qs(url.query).get("target") or ["0"])[0] or 0)

        started = time.time()
        best: bytes | None = None
        best_level = ""
        with tempfile.TemporaryDirectory() as folder:
            source = os.path.join(folder, "in.pdf")
            with open(source, "wb") as handle:
                handle.write(data)
            for level in LEVELS:
                out = os.path.join(folder, f"{level}.pdf")
                if not ghostscript(source, out, level):
                    continue
                with open(out, "rb") as handle:
                    result = handle.read()
                if best is None or len(result) < len(best):
                    best, best_level = result, level
                if target and len(result) <= target:
                    break
        print(f"shrink {length} -> {len(best) if best else 'failed'} ({best_level}) in {time.time() - started:.1f}s", flush=True)
        if best is None:
            return self.reply(422, b"could not read this PDF")
        self.reply(200, best, "application/pdf", {"X-Level": best_level})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    print(f"pdf-shrink listening on {port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
