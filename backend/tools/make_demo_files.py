"""Create demo files in backend/demo_files/ for manual and e2e testing."""

import io
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

OUT = Path(__file__).resolve().parent.parent / "demo_files"


def make_pdf(text: str) -> bytes:
    body = f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET".encode()
    objects = (
        b"<< /Type /Catalog /Pages 2 0 R >>\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        b"4 0 obj\n<< /Length " + str(len(body)).encode() + b" >>\nstream\n"
        + body + b"\nendstream\nendobj\n"
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    )
    return b"%PDF-1.4\n" + objects + b"trailer\n<< /Size 6 /Root 1 0 R >>\n%%EOF\n"


def make_docx() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "<Types>demo</Types>")
        zf.writestr("word/document.xml", "<w:document>demo notes</w:document>")
        zf.writestr("_rels/.rels", "<Relationships/>")
    return buf.getvalue()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "valid-notes.pdf": make_pdf("SeniMate demo notes"),
        "program.exe": b"MZ\x90\x00 fake executable bytes for upload rejection test",
        "empty.pdf": b"",
        "too-big.pdf": b"%PDF-1.4\n" + b"0" * (11 * 1024 * 1024),
        "fake.pdf": b"this is plain text pretending to be a pdf\n",
        "notes.docx": make_docx(),
    }
    for name, data in files.items():
        (OUT / name).write_bytes(data)
        print(f"wrote {OUT / name} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
