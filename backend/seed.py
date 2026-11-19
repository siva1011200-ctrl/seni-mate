"""Seed the database with demo data and real files on disk.

Usage:  python seed.py --reset
Drops and recreates the DB, deletes uploaded files, reseeds.
"""

import argparse
import base64
import hashlib
import io
import shutil
import sqlite3
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import (  # noqa: E402
    db_path,
    get_conn,
    init_db,
    upload_dir,
    using_postgres,
)
from app.storage import (  # noqa: E402
    delete_all_remote_files,
    save_file,
    using_remote_storage,
)

USERS = [
    (1, "Arun Kumar", "arun@example.edu", "CSE", "senior", 4),
    (2, "Divya S", "divya@example.edu", "AI&DS", "senior", 4),
    (3, "Karthik R", "karthik@example.edu", "CSE", "junior", 2),
    (4, "Meena P", "meena@example.edu", "AI&DS", "junior", 2),
    (5, "Priya N", "priya@example.edu", "CSE", "moderator", 4),
]

SUBJECTS = [
    (1, "CS3301", "Data Structures", 3, "CSE"),
    (2, "CS3351", "Digital Principles and Computer Organization", 3, "CSE"),
    (3, "CS3492", "Database Management Systems", 4, "CSE"),
    (4, "CS3401", "Algorithms", 4, "CSE"),
    (5, "AD3391", "Database Design and Management", 3, "AI&DS"),
    (6, "AD3491", "Fundamentals of Data Science and Analytics", 4, "AI&DS"),
]

# (id, title, description, type, subject_id, uploader_id, uploader_name,
#  status, created_at, download_count, file_name, reject_reason, file_kind)
RESOURCES = [
    (1, "Data Structures complete notes - Units 1 to 4",
     "Handwritten-style typed notes covering arrays, stacks, queues, linked lists and trees.",
     "notes", 1, 1, "Arun Kumar", "approved", "2026-11-02T10:30:00", 14,
     "ds-notes-units-1-4.pdf", None, "pdf"),
    (2, "DBMS previous paper - Nov 2025 attempt",
     "Question paper with the marking scheme attached at the end.",
     "previous_paper", 3, 1, "Arun Kumar", "approved", "2026-10-28T15:10:00", 31,
     "dbms-previous-paper-nov2025.pdf", None, "pdf"),
    (3, "How I cleared DBMS in two weeks - tips",
     "Study plan, important topics and common exam traps shared after my fourth semester.",
     "tips", 3, 2, "Divya S", "approved", "2026-11-08T09:05:00", 9,
     "dbms-prep-tips.docx", None, "docx"),
    (4, "Database Design and Management lecture notes",
     "Normalized notes for ER diagrams, functional dependencies and SQL basics.",
     "notes", 5, 2, "Divya S", "approved", "2026-11-12T11:45:00", 6,
     "dbdm-lecture-notes.pdf", None, "pdf"),
    (5, "Algorithms Unit 3 slides - greedy and dynamic programming",
     "Slides from the Unit 3 lecture plus two solved examples.",
     "notes", 4, 2, "Divya S", "pending", "2026-11-15T13:20:00", 0,
     "algorithms-unit3-slides.pptx", None, "pptx"),
    (6, "Data Structures mid-term question bank",
     "Scanned question bank from the previous three mid-terms.",
     "previous_paper", 1, 1, "Arun Kumar", "rejected", "2026-10-20T08:00:00", 0,
     "ds-question-bank-scan.pdf",
     "The scan is unreadable. Please upload a clearer copy.", "pdf"),
]

# 1x1 transparent PNG
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def make_pdf(tag: str) -> bytes:
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
    header = b"%PDF-1.4\n"
    xref_pos = len(header) + len(objects)
    return header + objects + b"trailer\n<< /Size 6 /Root 1 0 R >>\n%%EOF\n"


def make_zip(ext_prefix: str, extra_name: str, tag: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", f'<Types>{tag}</Types>')
        zf.writestr(extra_name, f"<doc>{tag}</doc>")
        zf.writestr("_rels/.rels", "<Relationships/>")
    return buf.getvalue()


def file_bytes(kind: str, tag: str) -> bytes:
    if kind == "pdf":
        return make_pdf(tag)
    if kind == "docx":
        return make_zip("word/", "word/document.xml", tag)
    if kind == "pptx":
        return make_zip("ppt/", "ppt/presentation.xml", tag)
    if kind == "png":
        return PNG_BYTES + tag.encode()
    raise ValueError(kind)


def reset_dirs() -> None:
    if using_postgres():
        # Cloud DB: wipe rows and remote objects instead of deleting files.
        with get_conn() as conn:
            for table in ("reports", "bookmarks", "resources", "subjects", "users"):
                conn.execute(f"DELETE FROM {table}")
        delete_all_remote_files()
        return
    path = db_path()
    if path.exists():
        path.unlink()
    up = upload_dir()
    if up.exists():
        shutil.rmtree(up)
    up.mkdir(parents=True, exist_ok=True)
    path.parent.mkdir(parents=True, exist_ok=True)


def seed() -> None:
    init_db()
    up = upload_dir()
    up.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executemany(
            "INSERT INTO users (id, name, email, department, role, year) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            USERS,
        )
        conn.executemany(
            "INSERT INTO subjects (id, code, name, semester, department) "
            "VALUES (?, ?, ?, ?, ?)",
            SUBJECTS,
        )
        for r in RESOURCES:
            (rid, title, desc, rtype, sid, uid, uname, status, created,
             downloads, fname, reject, kind) = r
            ext = "." + fname.rsplit(".", 1)[-1].lower()
            content = file_bytes(kind, f"{rid}:{title}")
            stored = save_file(content, ext)
            file_hash = hashlib.sha256(content).hexdigest()
            conn.execute(
                """INSERT INTO resources
                   (id, title, description, resource_type, subject_id, uploader_id,
                    file_name, stored_name, file_hash, status, reject_reason,
                    download_count, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (rid, title, desc, rtype, sid, uid, fname, stored, file_hash,
                 status, reject, downloads, created),
            )
        conn.commit()
    if using_postgres():
        # explicit ids were inserted; move the SERIAL sequences past them
        with get_conn() as conn:
            for table in ("users", "subjects", "resources", "bookmarks", "reports"):
                conn.execute(
                    "SELECT setval(pg_get_serial_sequence(?, 'id'), "
                    "(SELECT COALESCE(MAX(id), 1) FROM " + table + "))",
                    (table,),
                )
    print(f"Seeded {len(USERS)} users, {len(SUBJECTS)} subjects, {len(RESOURCES)} resources.")
    db_label = "postgres (DATABASE_URL)" if using_postgres() else str(db_path())
    up_label = "supabase storage" if using_remote_storage() else str(up)
    print(f"DB: {db_label}  Uploads: {up_label}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="drop DB and uploads, then reseed")
    args = parser.parse_args()
    if args.reset:
        reset_dirs()
    seed()


if __name__ == "__main__":
    main()
