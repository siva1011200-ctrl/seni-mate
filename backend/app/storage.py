"""File storage helpers. Stored names are random uuid4 hex + extension;
user-supplied file names are never used in paths."""

import hashlib
import re
import uuid
from pathlib import Path

from .database import upload_dir

MAX_NAME = 120


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sanitize_filename(name: str | None) -> str:
    """Strip path parts and control characters for display / headers."""
    if not name:
        return "file"
    name = name.replace("\\", "/").split("/")[-1]
    name = "".join(ch for ch in name if ch.isprintable() and ch not in '"')
    name = name.strip().strip(".")
    if not name:
        return "file"
    if len(name) > MAX_NAME:
        stem, dot, ext = name.rpartition(".")
        name = (stem[: MAX_NAME - len(ext) - 1] + "." + ext) if dot else name[:MAX_NAME]
    return name


def save_file(content: bytes, ext: str) -> str:
    """Write content under UPLOAD_DIR with a random name. Returns stored_name."""
    stored_name = f"{uuid.uuid4().hex}{ext}"
    path = upload_dir() / stored_name
    path.write_bytes(content)
    return stored_name


def file_path(stored_name: str) -> Path | None:
    """Resolve a stored name safely; returns None if it escapes the dir."""
    base = upload_dir().resolve()
    path = (base / stored_name).resolve()
    if path.parent != base or not path.is_file():
        return None
    return path


def delete_file(stored_name: str) -> None:
    path = file_path(stored_name)
    if path:
        path.unlink(missing_ok=True)
