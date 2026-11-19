# SeniMate backend - test report

Date: 2026-11-19. Python 3.10.11, pytest 9.2.0, FastAPI TestClient.
Command: `.venv\Scripts\python.exe -m pytest tests -v` (run from `backend/`).

Every test runs against a fresh temporary SQLite DB and upload directory
(see `tests/conftest.py`) - real `hub.db` and `uploads/` are never touched.

## Results

| Test | What it checks | Result |
|------|----------------|--------|
| test_k1_valid_upload | Valid upload -> 201, status pending, correct metadata, subject joined, no email/hash/stored_name leaked, file on disk | PASS |
| test_k2_missing_title | Blank title -> 422 "Title is required." | PASS |
| test_k3_exe_rejected_no_trace | `.exe` -> 422 exact message, no DB row, no file on disk | PASS |
| test_k4_too_large | 11 MB file -> 413 "File is too large (11.0 MB). The limit is 10 MB." | PASS |
| test_k5_search_subject_and_type | subject_id + resource_type filters return only matching approved resources | PASS |
| test_k6_no_match | Unknown keyword -> 200 `[]` | PASS |
| test_k7_pending_visibility | Junior gets 403 on pending resource; uploader + moderator get 200; pending absent from GET /resources | PASS |
| test_k8_bookmark_twice | First bookmark 201 `created:true`, second 200 `created:false`, exactly one row | PASS |
| test_k9_unknown_resource | Unknown id -> 404 "Resource not found." | PASS |
| test_k10_report | Report with reason -> 201 and row saved; blank reason -> 422 exact message | PASS |
| test_empty_file | 0-byte file -> 422 "The file is empty. Choose a file with content." | PASS |
| test_fake_pdf_content_mismatch | Text renamed .pdf -> 422 content-mismatch message | PASS |
| test_duplicate_file_hash | Same bytes under a different name -> 409 with existing title | PASS |
| test_junior_cannot_upload | Junior upload -> 403 "Only seniors can upload resources." | PASS |
| test_review_permissions | Junior review -> 403; senior /pending -> 403 "Only moderators can review resources." | PASS |
| test_reject_requires_reason_and_approve_clears | Reject without reason -> 422; reject stores reason visible to uploader; approve clears reject_reason and publishes resource | PASS |
| test_bad_review_status | Invalid status -> 422 "Status must be approved or rejected." | PASS |
| test_no_email_anywhere | No "@" appears in any list/detail response body | PASS |
| test_missing_user_header | Missing/unknown X-User-Id -> 401 "Select a user to continue." on all protected routes | PASS |
| test_validation_error_detail_is_string | Malformed JSON -> 422 with string detail; non-numeric semester/subject_id -> exact 422 messages | PASS |
| test_download_increments_and_filename | Download returns file bytes, Content-Disposition has original name, count increments | PASS |
| test_download_pending_forbidden_junior | Junior download of pending resource -> 403 | PASS |
| test_filters_combine | q + department + semester + subject_id + type combine with AND | PASS |
| test_q_escaping | Searching "%" does not match everything (LIKE escaping) | PASS |
| test_my_uploads_all_statuses | /my-uploads returns all statuses for the caller only | PASS |
| test_reject_reason_hidden_from_others | reject_reason visible to uploader and moderator, null for others | PASS |
| test_health_and_public_endpoints | /health ok; /users and /subjects public with seeded data | PASS |

## Summary

```
27 passed, 3 warnings in 1.85s
```

(Warnings are upstream deprecation notices from FastAPI/Starlette, not failures.)

## End-to-end (frontend + backend)

The Playwright suite `frontend/scripts/e2e-check.mjs` was re-run against the real
backend (`VITE_USE_MOCK=false`, reseeded via `seed.py --reset`):
**37/37 checks passed** - see `frontend/scripts/e2e-results.json` and
`docs/PROJECT_REPORT.md`.
