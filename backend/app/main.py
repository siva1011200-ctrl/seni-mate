"""SeniMate backend - FastAPI app.

Every request except /health, /users and /subjects needs the X-User-Id header.
All errors are returned as {"detail": "<string>"}.
"""

import os
import sqlite3
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import storage
from .database import get_conn, init_db
from .storage import delete_file, file_path, sanitize_filename, save_file
from .validators import check_file, check_metadata

app = FastAPI(title="SeniMate API")

# Comma-separated origins via ALLOWED_ORIGINS; localhost defaults for dev.
_cors_origins = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


# ---------- error handlers: detail is always a single string ----------


def _detail_string(detail) -> str:
    if isinstance(detail, list):
        parts = [d.get("msg", "") for d in detail if isinstance(d, dict)]
        return "; ".join(p for p in parts if p) or "Invalid request."
    if isinstance(detail, str) and detail:
        return detail
    return "Invalid request."


@app.exception_handler(StarletteHTTPException)
async def http_exc_handler(request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc.detail)})


@app.exception_handler(RequestValidationError)
async def validation_exc_handler(request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": _detail_string(exc.errors())})


@app.exception_handler(Exception)
async def generic_exc_handler(request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Something went wrong."})


# ---------- helpers ----------


def get_current_user(x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Select a user to continue.")
    try:
        uid = int(x_user_id)
    except ValueError:
        uid = None
    if uid is None:
        raise HTTPException(status_code=401, detail="Select a user to continue.")
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Select a user to continue.")
    return dict(row)


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def can_access(resource: dict, user: dict) -> bool:
    return (
        resource["status"] == "approved"
        or resource["uploader_id"] == user["id"]
        or user["role"] == "moderator"
    )


def resource_json(r: dict, user: dict) -> dict:
    # r comes from row_to_dict: subject is already a dict, uploader_name present.
    is_mod_or_owner = user["role"] == "moderator" or r["uploader_id"] == user["id"]
    # reject_reason is only filled for the uploader and for moderators
    reject_reason = r["reject_reason"] if is_mod_or_owner else None
    return {
        "id": r["id"],
        "title": r["title"],
        "description": r["description"],
        "resource_type": r["resource_type"],
        "status": r["status"],
        "subject": r["subject"],
        "uploader_name": r["uploader_name"],
        "created_at": r["created_at"],
        "download_count": r["download_count"],
        "file_name": r["file_name"],
        "is_bookmarked": bool(r.get("is_bookmarked")),
        "reject_reason": reject_reason,
    }


RESOURCE_SELECT = """
SELECT r.*, u.name AS uploader_name, s.id AS s_id, s.code AS s_code, s.name AS s_name,
       s.semester AS s_semester, s.department AS s_department,
       EXISTS(SELECT 1 FROM bookmarks b WHERE b.resource_id = r.id AND b.user_id = :uid) AS is_bookmarked
FROM resources r
JOIN users u ON u.id = r.uploader_id
JOIN subjects s ON s.id = r.subject_id
"""


def row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["subject"] = {
        "id": d.pop("s_id"),
        "code": d.pop("s_code"),
        "name": d.pop("s_name"),
        "semester": d.pop("s_semester"),
        "department": d.pop("s_department"),
    }
    return d


def get_resource_or_404(conn, rid: int, uid: int):
    try:
        rid = int(rid)
    except (TypeError, ValueError):
        raise HTTPException(status_code=404, detail="Resource not found.")
    row = conn.execute(
        RESOURCE_SELECT.replace(":uid", "?") + " WHERE r.id = ?",
        (uid, rid),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Resource not found.")
    return row_to_dict(row)


# ---------- public endpoints ----------


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/users")
def list_users():
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, role, department FROM users ORDER BY id"
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/subjects")
def list_subjects():
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, code, name, semester, department FROM subjects "
            "ORDER BY department, semester, code"
        ).fetchall()
    return [dict(r) for r in rows]


# ---------- resources ----------


@app.post("/resources", status_code=201)
async def create_resource(
    user: dict = Depends(get_current_user),
    title: str = Form(default=""),
    description: str = Form(default=""),
    resource_type: str = Form(default=""),
    subject_id: str = Form(default=""),
    file: UploadFile | None = File(default=None),
):
    clean_title, subject = check_metadata(user, title, resource_type, subject_id)
    ext, content, file_hash = check_file(user, file, subject, clean_title)

    stored_name = save_file(content, f".{ext}")
    try:
        with get_conn() as conn:
            # RETURNING id works on both SQLite (>=3.35) and Postgres
            row = conn.execute(
                """INSERT INTO resources
                   (title, description, resource_type, subject_id, uploader_id,
                    file_name, stored_name, file_hash, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                   RETURNING id""",
                (
                    clean_title,
                    description,
                    resource_type,
                    subject["id"],
                    user["id"],
                    sanitize_filename(file.filename),
                    stored_name,
                    file_hash,
                    now_iso(),
                ),
            ).fetchone()
            rid = row["id"]
            row = get_resource_or_404(conn, rid, user["id"])
    except Exception:
        delete_file(stored_name)
        raise
    return resource_json(row, user)


@app.get("/resources")
def list_resources(
    user: dict = Depends(get_current_user),
    q: str = "",
    department: str = "",
    semester: str = "",
    subject_id: str = "",
    resource_type: str = "",
):
    clauses = ["r.status = 'approved'"]
    params: list = []

    if q:
        esc = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{esc}%"
        clauses.append(
            "(r.title LIKE ? ESCAPE '\\' OR r.description LIKE ? ESCAPE '\\' "
            "OR s.name LIKE ? ESCAPE '\\' OR s.code LIKE ? ESCAPE '\\')"
        )
        params += [like, like, like, like]
    if department:
        clauses.append("s.department = ?")
        params.append(department)
    if semester:
        try:
            clauses.append("s.semester = ?")
            params.append(int(semester))
        except ValueError:
            raise HTTPException(status_code=422, detail="Semester must be a number.")
    if subject_id:
        try:
            clauses.append("r.subject_id = ?")
            params.append(int(subject_id))
        except ValueError:
            raise HTTPException(status_code=422, detail="Subject must be a number.")
    if resource_type:
        clauses.append("r.resource_type = ?")
        params.append(resource_type)

    sql = RESOURCE_SELECT.replace(":uid", "?") + " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY r.created_at DESC, r.id DESC"
    with get_conn() as conn:
        rows = conn.execute(sql, [user["id"], *params]).fetchall()
    return [resource_json(row_to_dict(r), user) for r in rows]


@app.get("/resources/{rid}")
def get_resource(rid: int, user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        r = get_resource_or_404(conn, rid, user["id"])
    if not can_access(r, user):
        raise HTTPException(status_code=403, detail="You don't have access to this resource.")
    return resource_json(r, user)


def _content_disposition(filename: str) -> str:
    safe = sanitize_filename(filename)
    ascii_name = "".join(ch if ord(ch) < 128 else "_" for ch in safe)
    return (
        f'attachment; filename="{ascii_name}"; '
        f"filename*=UTF-8''{quote(safe)}"
    )


@app.get("/resources/{rid}/download")
def download_resource(rid: int, user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        r = get_resource_or_404(conn, rid, user["id"])
        if not can_access(r, user):
            raise HTTPException(status_code=403, detail="You don't have access to this resource.")
        if storage.using_remote_storage():
            data = storage.read_file_bytes(r["stored_name"])
            if data is None:
                raise HTTPException(status_code=404, detail="File not found.")
            conn.execute(
                "UPDATE resources SET download_count = download_count + 1 WHERE id = ?",
                (r["id"],),
            )
            return Response(
                content=data,
                media_type="application/octet-stream",
                headers={"Content-Disposition": _content_disposition(r["file_name"])},
            )
        path = file_path(r["stored_name"])
        if path is None:
            raise HTTPException(status_code=404, detail="File not found.")
        conn.execute(
            "UPDATE resources SET download_count = download_count + 1 WHERE id = ?",
            (r["id"],),
        )
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=sanitize_filename(r["file_name"]),
    )


@app.get("/my-uploads")
def my_uploads(user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute(
            RESOURCE_SELECT.replace(":uid", "?")
            + " WHERE r.uploader_id = ? ORDER BY r.created_at DESC, r.id DESC",
            (user["id"], user["id"]),
        ).fetchall()
    return [resource_json(row_to_dict(r), user) for r in rows]


@app.get("/pending")
def pending(user: dict = Depends(get_current_user)):
    if user["role"] != "moderator":
        raise HTTPException(status_code=403, detail="Only moderators can review resources.")
    with get_conn() as conn:
        rows = conn.execute(
            RESOURCE_SELECT.replace(":uid", "?")
            + " WHERE r.status = 'pending' ORDER BY r.created_at ASC, r.id ASC",
            (user["id"],),
        ).fetchall()
    return [resource_json(row_to_dict(r), user) for r in rows]


class ReviewIn(BaseModel):
    status: str = ""
    reason: str = ""


@app.patch("/resources/{rid}/review")
def review_resource(rid: int, body: ReviewIn, user: dict = Depends(get_current_user)):
    if user["role"] != "moderator":
        raise HTTPException(status_code=403, detail="Only moderators can review resources.")
    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="Status must be approved or rejected.")
    reason = (body.reason or "").strip()
    if body.status == "rejected" and not reason:
        raise HTTPException(status_code=422, detail="Give a reason when rejecting.")
    with get_conn() as conn:
        r = get_resource_or_404(conn, rid, user["id"])
        conn.execute(
            """UPDATE resources SET status = ?, reject_reason = ?,
               reviewed_by = ?, reviewed_at = ? WHERE id = ?""",
            (
                body.status,
                reason if body.status == "rejected" else None,
                user["id"],
                now_iso(),
                r["id"],
            ),
        )
        row = get_resource_or_404(conn, rid, user["id"])
    return resource_json(row, user)


@app.post("/resources/{rid}/bookmark")
def bookmark(rid: int, user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        r = get_resource_or_404(conn, rid, user["id"])
        if not can_access(r, user):
            raise HTTPException(status_code=403, detail="You don't have access to this resource.")
        existing = conn.execute(
            "SELECT id FROM bookmarks WHERE user_id = ? AND resource_id = ?",
            (user["id"], r["id"]),
        ).fetchone()
        if existing:
            return JSONResponse(status_code=200, content={"created": False})
        conn.execute(
            "INSERT INTO bookmarks (user_id, resource_id, created_at) VALUES (?, ?, ?)",
            (user["id"], r["id"], now_iso()),
        )
        return JSONResponse(status_code=201, content={"created": True})


@app.get("/bookmarks")
def bookmarks(user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute(
            RESOURCE_SELECT.replace(":uid", "?")
            + """ JOIN bookmarks b ON b.resource_id = r.id AND b.user_id = ?
                WHERE r.status = 'approved'
                ORDER BY b.created_at DESC, b.id DESC""",
            (user["id"], user["id"]),
        ).fetchall()
    return [resource_json(row_to_dict(r), user) for r in rows]


class ReportIn(BaseModel):
    reason: str = ""


@app.post("/resources/{rid}/report", status_code=201)
def report(rid: int, body: ReportIn, user: dict = Depends(get_current_user)):
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=422, detail="Tell us what is wrong with this resource.")
    with get_conn() as conn:
        r = get_resource_or_404(conn, rid, user["id"])
        if not can_access(r, user):
            raise HTTPException(status_code=403, detail="You don't have access to this resource.")
        conn.execute(
            "INSERT INTO reports (resource_id, reporter_id, reason, status, created_at) "
            "VALUES (?, ?, ?, 'open', ?)",
            (r["id"], user["id"], reason, now_iso()),
        )
    return {"created": True}
