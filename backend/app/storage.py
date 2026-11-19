"""File storage: local disk for dev/tests, Supabase Storage when configured.

Env vars (production only, keep them secret):
  SUPABASE_URL          e.g. https://xyz.supabase.co
  SUPABASE_SERVICE_KEY  service-role key (backend only, never in frontend)
  SUPABASE_BUCKET       bucket name, default "resources"

Stored names are random uuid4 hex + extension; user-supplied file names are
never used in paths or object keys.
"""

import hashlib
import os
import uuid
from pathlib import Path

from .database import upload_dir

MAX_NAME = 120


def supabase_config():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if url and key:
        return url.rstrip("/"), key, os.environ.get("SUPABASE_BUCKET") or "resources"
    return None


def using_remote_storage() -> bool:
    return supabase_config() is not None


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


def _sb_headers(key: str) -> dict:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/octet-stream",
    }


def save_file(content: bytes, ext: str) -> str:
    """Store content, return stored_name (uuid hex + ext)."""
    stored_name = f"{uuid.uuid4().hex}{ext}"
    cfg = supabase_config()
    if cfg:
        url, key, bucket = cfg
        import httpx

        r = httpx.post(
            f"{url}/storage/v1/object/{bucket}/{stored_name}",
            content=content,
            headers=_sb_headers(key),
            timeout=60,
        )
        r.raise_for_status()
        return stored_name
    path = upload_dir() / stored_name
    path.write_bytes(content)
    return stored_name


def read_file_bytes(stored_name: str) -> bytes | None:
    cfg = supabase_config()
    if cfg:
        url, key, bucket = cfg
        import httpx

        r = httpx.get(
            f"{url}/storage/v1/object/{bucket}/{stored_name}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=60,
        )
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.content
    path = file_path(stored_name)
    return path.read_bytes() if path else None


def delete_file(stored_name: str) -> None:
    cfg = supabase_config()
    if cfg:
        url, key, bucket = cfg
        import httpx

        httpx.delete(
            f"{url}/storage/v1/object/{bucket}/{stored_name}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=30,
        )
        return
    path = file_path(stored_name)
    if path:
        path.unlink(missing_ok=True)


def delete_all_remote_files() -> None:
    """Best-effort wipe of the bucket (used by seed --reset in production)."""
    cfg = supabase_config()
    if not cfg:
        return
    url, key, bucket = cfg
    import httpx

    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    r = httpx.post(
        f"{url}/storage/v1/object/list/{bucket}",
        json={"prefix": "", "limit": 1000},
        headers=headers,
        timeout=30,
    )
    if r.status_code != 200:
        return
    for obj in r.json():
        name = obj.get("name")
        if name:
            httpx.request(
                "DELETE",
                f"{url}/storage/v1/object/{bucket}/{name}",
                headers=headers,
                timeout=30,
            )


def file_path(stored_name: str) -> Path | None:
    """Local-only path resolution; returns None for remote storage or escapes."""
    if using_remote_storage():
        return None
    base = upload_dir().resolve()
    path = (base / stored_name).resolve()
    if path.parent != base or not path.is_file():
        return None
    return path
