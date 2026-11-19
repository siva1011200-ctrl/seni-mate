"""Upload validation. Runs the contract checks in the required order;
the first failure wins. Raises HTTPException with the exact detail strings."""

import io
import os
import zipfile

from fastapi import HTTPException, UploadFile

from .database import get_conn
from .storage import sanitize_filename, sha256_hex

ALLOWED_TYPES = {"notes", "previous_paper", "tips"}
ALLOWED_EXTENSIONS = {"pdf", "docx", "pptx", "png", "jpg"}

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPG_MAGIC = b"\xff\xd8\xff"


def max_upload_bytes() -> int:
    mb = float(os.environ.get("MAX_UPLOAD_MB", "10"))
    return int(mb * 1024 * 1024)


def _fail(status: int, detail: str):
    raise HTTPException(status_code=status, detail=detail)


def check_metadata(user: dict, title: str, resource_type: str, subject_id_raw: str):
    """Steps 1-4 of upload validation. Returns (clean_title, subject_row)."""
    if user["role"] == "junior":
        _fail(403, "Only seniors can upload resources.")

    clean_title = (title or "").strip()
    if not clean_title:
        _fail(422, "Title is required.")
    if len(clean_title) > 200:
        _fail(422, "Title must be 200 characters or fewer.")

    if resource_type not in ALLOWED_TYPES:
        _fail(422, "Choose a resource type.")

    subject = None
    try:
        sid = int(str(subject_id_raw).strip())
    except (TypeError, ValueError):
        sid = None
    if sid is not None:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM subjects WHERE id = ?", (sid,)).fetchone()
        subject = dict(row) if row else None
    if subject is None:
        _fail(422, "Choose a subject.")

    return clean_title, subject


def _spooled_size(file: UploadFile) -> int:
    f = file.file
    pos = f.tell()
    f.seek(0, 2)
    size = f.tell()
    f.seek(pos)
    return size


def check_file(user: dict, file: UploadFile | None, subject: dict, title: str):
    """Steps 5-9. Returns (ext, content_bytes, file_hash)."""
    if file is None or file.filename is None:
        _fail(422, "The file is empty. Choose a file with content.")
    if _spooled_size(file) == 0:
        _fail(422, "The file is empty. Choose a file with content.")

    original = sanitize_filename(file.filename)
    dot = original.rfind(".")
    ext = original[dot + 1:].lower() if dot >= 0 else ""
    if ext not in ALLOWED_EXTENSIONS:
        shown = f".{ext}" if ext else "(none)"
        _fail(422, f"File type {shown} is not allowed. Use PDF, DOCX, PPTX, PNG or JPG.")

    size = _spooled_size(file)
    limit_mb = max_upload_bytes() // (1024 * 1024)
    if size > max_upload_bytes():
        _fail(
            413,
            f"File is too large ({size / (1024 * 1024):.1f} MB). The limit is {limit_mb:g} MB.",
        )

    file.file.seek(0)
    content = file.file.read()
    if not _content_matches(content, ext):
        _fail(
            422,
            "The file content does not match its extension. "
            "Upload a real PDF, DOCX, PPTX, PNG or JPG.",
        )

    file_hash = sha256_hex(content)
    with get_conn() as conn:
        dup = conn.execute(
            "SELECT title FROM resources WHERE file_hash = ?", (file_hash,)
        ).fetchone()
    if dup:
        _fail(409, f'This file was already uploaded as "{dup["title"]}".')

    return ext, content, file_hash


def _content_matches(content: bytes, ext: str) -> bool:
    if ext == "pdf":
        return content.startswith(b"%PDF")
    if ext == "png":
        return content.startswith(PNG_MAGIC)
    if ext == "jpg":
        return content.startswith(JPG_MAGIC)
    if ext in ("docx", "pptx"):
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                names = zf.namelist()
            has_types = "[Content_Types].xml" in names
            prefix = "word/" if ext == "docx" else "ppt/"
            has_entry = any(n.startswith(prefix) for n in names)
            return has_types and has_entry
        except zipfile.BadZipFile:
            return False
    return False
