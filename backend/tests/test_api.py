"""API tests for SeniMate backend. Every test runs on a fresh seeded
temp DB + upload dir (see conftest.py)."""

import io
import json
import os
import zipfile

from conftest import USERS, hdr, make_docx, make_pdf, upload


def detail(resp):
    return resp.json()["detail"]


# ---------- K1 ----------
def test_k1_valid_upload(client):
    before = len(os.listdir(os.environ["UPLOAD_DIR"]))
    r = upload(client, USERS["arun"], title="Unit 5 notes", content=make_pdf("unit5"))
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "pending"
    assert data["title"] == "Unit 5 notes"
    assert data["resource_type"] == "notes"
    assert data["subject"]["code"] == "CS3301"
    assert data["uploader_name"] == "Arun Kumar"
    assert "@" not in json.dumps(data)  # no email anywhere
    assert "stored_name" not in data and "file_hash" not in data
    assert len(os.listdir(os.environ["UPLOAD_DIR"])) == before + 1


# ---------- K2 ----------
def test_k2_missing_title(client):
    r = upload(client, USERS["arun"], title="   ")
    assert r.status_code == 422
    assert detail(r) == "Title is required."


# ---------- K3 ----------
def test_k3_exe_rejected_no_trace(client):
    up = os.environ["UPLOAD_DIR"]
    before_files = set(os.listdir(up))
    r = client.post(
        "/resources",
        data={"title": "evil", "resource_type": "notes", "subject_id": "1"},
        files={"file": ("program.exe", b"MZ fake", "application/octet-stream")},
        headers=hdr(USERS["arun"]),
    )
    assert r.status_code == 422
    assert detail(r) == "File type .exe is not allowed. Use PDF, DOCX, PPTX, PNG or JPG."
    assert set(os.listdir(up)) == before_files
    res = client.get("/my-uploads", headers=hdr(USERS["arun"])).json()
    assert all(x["title"] != "evil" for x in res)


# ---------- K4 ----------
def test_k4_too_large(client):
    big = b"%PDF-1.4\n" + b"0" * (11 * 1024 * 1024)
    r = upload(client, USERS["arun"], title="big", filename="big.pdf", content=big)
    assert r.status_code == 413
    assert detail(r) == "File is too large (11.0 MB). The limit is 10 MB."


# ---------- K5 ----------
def test_k5_search_subject_and_type(client):
    r = client.get("/resources?subject_id=1&resource_type=notes", headers=hdr(USERS["karthik"]))
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    assert all(i["subject"]["id"] == 1 and i["resource_type"] == "notes" for i in items)
    assert all(i["status"] == "approved" for i in items)


# ---------- K6 ----------
def test_k6_no_match(client):
    r = client.get("/resources?q=zzzznotathing", headers=hdr(USERS["karthik"]))
    assert r.status_code == 200
    assert r.json() == []


# ---------- K7 ----------
def test_k7_pending_visibility(client):
    # pending resource id 5 (Algorithms slides, uploader Divya)
    r = client.get("/resources/5", headers=hdr(USERS["karthik"]))
    assert r.status_code == 403
    assert detail(r) == "You don't have access to this resource."
    # uploader can open
    r = client.get("/resources/5", headers=hdr(USERS["divya"]))
    assert r.status_code == 200 and r.json()["status"] == "pending"
    # moderator can open
    r = client.get("/resources/5", headers=hdr(USERS["priya"]))
    assert r.status_code == 200
    # pending absent from public list
    ids = [i["id"] for i in client.get("/resources", headers=hdr(USERS["karthik"])).json()]
    assert 5 not in ids and 6 not in ids  # rejected also hidden


# ---------- K8 ----------
def test_k8_bookmark_twice(client):
    r1 = client.post("/resources/1/bookmark", headers=hdr(USERS["karthik"]))
    assert r1.status_code == 201 and r1.json() == {"created": True}
    r2 = client.post("/resources/1/bookmark", headers=hdr(USERS["karthik"]))
    assert r2.status_code == 200 and r2.json() == {"created": False}
    bms = client.get("/bookmarks", headers=hdr(USERS["karthik"])).json()
    assert sum(1 for b in bms if b["id"] == 1) == 1


# ---------- K9 ----------
def test_k9_unknown_resource(client):
    r = client.get("/resources/9999", headers=hdr(USERS["karthik"]))
    assert r.status_code == 404
    assert detail(r) == "Resource not found."


# ---------- K10 ----------
def test_k10_report(client):
    r = client.post("/resources/1/report", json={"reason": "wrong file"},
                    headers=hdr(USERS["karthik"]))
    assert r.status_code == 201 and r.json() == {"created": True}
    r = client.post("/resources/1/report", json={"reason": "  "},
                    headers=hdr(USERS["karthik"]))
    assert r.status_code == 422
    assert detail(r) == "Tell us what is wrong with this resource."


# ---------- extras ----------
def test_empty_file(client):
    r = upload(client, USERS["arun"], title="empty", filename="empty.pdf", content=b"")
    assert r.status_code == 422
    assert detail(r) == "The file is empty. Choose a file with content."


def test_fake_pdf_content_mismatch(client):
    r = upload(client, USERS["arun"], title="fake", filename="fake.pdf",
               content=b"plain text not a pdf")
    assert r.status_code == 422
    assert "content does not match" in detail(r)


def test_duplicate_file_hash(client):
    content = make_pdf("unique-dup-check")
    r1 = upload(client, USERS["arun"], title="first copy", content=content)
    assert r1.status_code == 201
    r2 = upload(client, USERS["arun"], title="second copy",
                filename="renamed.pdf", content=content)
    assert r2.status_code == 409
    assert detail(r2) == 'This file was already uploaded as "first copy".'


def test_junior_cannot_upload(client):
    r = upload(client, USERS["karthik"], title="nope")
    assert r.status_code == 403
    assert detail(r) == "Only seniors can upload resources."


def test_review_permissions(client):
    # junior cannot review
    r = client.patch("/resources/5/review", json={"status": "approved"},
                     headers=hdr(USERS["karthik"]))
    assert r.status_code == 403
    assert detail(r) == "Only moderators can review resources."
    # senior cannot list pending
    r = client.get("/pending", headers=hdr(USERS["arun"]))
    assert r.status_code == 403
    assert detail(r) == "Only moderators can review resources."


def test_reject_requires_reason_and_approve_clears(client):
    r = client.patch("/resources/5/review", json={"status": "rejected"},
                     headers=hdr(USERS["priya"]))
    assert r.status_code == 422
    assert detail(r) == "Give a reason when rejecting."
    r = client.patch("/resources/5/review",
                     json={"status": "rejected", "reason": "blurry scan"},
                     headers=hdr(USERS["priya"]))
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"
    # reject_reason visible to uploader
    r = client.get("/resources/5", headers=hdr(USERS["divya"]))
    assert r.json()["reject_reason"] == "blurry scan"
    # approve clears it and makes it public
    r = client.patch("/resources/5/review", json={"status": "approved"},
                     headers=hdr(USERS["priya"]))
    assert r.status_code == 200
    assert r.json()["status"] == "approved" and r.json()["reject_reason"] is None
    r = client.get("/resources/5", headers=hdr(USERS["karthik"]))
    assert r.status_code == 200


def test_bad_review_status(client):
    r = client.patch("/resources/5/review", json={"status": "maybe"},
                     headers=hdr(USERS["priya"]))
    assert r.status_code == 422
    assert detail(r) == "Status must be approved or rejected."


def test_no_email_anywhere(client):
    for path in ["/users", "/subjects", "/resources", "/resources/1",
                 "/my-uploads", "/bookmarks"]:
        uid = USERS["priya"] if path == "/pending" else USERS["karthik"]
        r = client.get(path, headers=hdr(uid))
        assert "@" not in r.text, path
    r = client.get("/pending", headers=hdr(USERS["priya"]))
    assert "@" not in r.text


def test_missing_user_header(client):
    for path in ["/resources", "/resources/1", "/my-uploads", "/pending",
                 "/bookmarks"]:
        r = client.get(path)
        assert r.status_code == 401, path
        assert detail(r) == "Select a user to continue."
    r = client.get("/resources", headers={"X-User-Id": "999"})
    assert r.status_code == 401


def test_validation_error_detail_is_string(client):
    # malformed JSON body on review -> RequestValidationError, still string detail
    r = client.patch("/resources/1/review", content=b"not json",
                     headers={**hdr(USERS["priya"]), "Content-Type": "application/json"})
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)
    # non-numeric semester filter
    r = client.get("/resources?semester=abc", headers=hdr(USERS["karthik"]))
    assert r.status_code == 422
    assert detail(r) == "Semester must be a number."
    r = client.get("/resources?subject_id=abc", headers=hdr(USERS["karthik"]))
    assert r.status_code == 422
    assert detail(r) == "Subject must be a number."


def test_download_increments_and_filename(client):
    r = client.get("/resources/1/download", headers=hdr(USERS["karthik"]))
    assert r.status_code == 200
    assert "dbms" not in (r.headers.get("content-disposition") or "")
    assert "ds-notes-units-1-4.pdf" in r.headers.get("content-disposition", "")
    detail_res = client.get("/resources/1", headers=hdr(USERS["karthik"])).json()
    assert detail_res["download_count"] == 15
    assert r.content.startswith(b"%PDF")


def test_download_pending_forbidden_junior(client):
    r = client.get("/resources/5/download", headers=hdr(USERS["karthik"]))
    assert r.status_code == 403


def test_filters_combine(client):
    r = client.get(
        "/resources?q=database&department=CSE&semester=4&subject_id=3&resource_type=previous_paper",
        headers=hdr(USERS["karthik"]),
    )
    assert r.status_code == 200
    items = r.json()
    assert all(i["subject"]["id"] == 3 for i in items)
    assert all(i["resource_type"] == "previous_paper" for i in items)


def test_q_escaping(client):
    # "%" is a LIKE wildcard; escaped input must not match everything
    r = client.get("/resources?q=%25", headers=hdr(USERS["karthik"]))
    assert r.status_code == 200
    assert r.json() == []


def test_my_uploads_all_statuses(client):
    items = client.get("/my-uploads", headers=hdr(USERS["divya"])).json()
    statuses = {i["status"] for i in items}
    assert "pending" in statuses
    assert all(i["uploader_name"] == "Divya S" for i in items)


def test_reject_reason_hidden_from_others(client):
    client.patch("/resources/5/review",
                 json={"status": "rejected", "reason": "secret reason"},
                 headers=hdr(USERS["priya"]))
    # moderator sees it
    r = client.get("/resources/5", headers=hdr(USERS["priya"])).json()
    assert r["reject_reason"] == "secret reason"
    # uploader sees it
    r = client.get("/resources/5", headers=hdr(USERS["divya"])).json()
    assert r["reject_reason"] == "secret reason"
    # unrelated senior does NOT (403 anyway) - use a second pending->approved flow:
    # approve it, then a rejected resource visible only to owner/mod is covered above.
    # For an approved resource reject_reason is null for everyone:
    client.patch("/resources/5/review", json={"status": "approved"},
                 headers=hdr(USERS["priya"]))
    r = client.get("/resources/5", headers=hdr(USERS["karthik"])).json()
    assert r["reject_reason"] is None


def test_health_and_public_endpoints(client):
    assert client.get("/health").json() == {"status": "ok"}
    users = client.get("/users").json()
    assert len(users) == 5 and users[0]["name"] == "Arun Kumar"
    subs = client.get("/subjects").json()
    assert len(subs) == 6
