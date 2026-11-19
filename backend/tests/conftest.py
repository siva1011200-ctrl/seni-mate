"""Pytest fixtures: every test gets a fresh temp DB and upload dir,
seeded with the demo data. Never touches real backend/hub.db or uploads/."""

import base64
import io
import os
import sys
import zipfile
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("MAX_UPLOAD_MB", "10")

from fastapi.testclient import TestClient  # noqa: E402

import seed  # noqa: E402
from app.main import app  # noqa: E402

PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def make_pdf(tag: str = "test") -> bytes:
    body = f"BT /F1 12 Tf 50 700 Td ({tag}) Tj ET".encode()
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


def make_docx(tag: str = "doc") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("word/document.xml", f"<w:document>{tag}</w:document>")
        zf.writestr("_rels/.rels", "<Relationships/>")
    return buf.getvalue()


@pytest.fixture()
def env(tmp_path, monkeypatch):
    # isolate from any real cloud credentials on the machine
    for var in ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_BUCKET"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
    seed.reset_dirs()
    seed.seed()
    return tmp_path


@pytest.fixture()
def client(env):
    with TestClient(app) as c:
        yield c


USERS = {
    "arun": "1",    # senior CSE
    "divya": "2",   # senior AI&DS
    "karthik": "3", # junior CSE
    "meena": "4",   # junior AI&DS
    "priya": "5",   # moderator CSE
}


def hdr(uid: str) -> dict:
    return {"X-User-Id": uid}


def upload(client, uid, title="Test upload", rtype="notes", subject="1",
           filename="test.pdf", content=None, description=""):
    if content is None:
        content = make_pdf(title)
    return client.post(
        "/resources",
        data={"title": title, "description": description,
              "resource_type": rtype, "subject_id": subject},
        files={"file": (filename, content, "application/octet-stream")},
        headers=hdr(uid),
    )
