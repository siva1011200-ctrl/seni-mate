# SeniMate frontend - test report

Date: 2026-11-19. Mode tested: `VITE_USE_MOCK=true` (built-in mock backend).
Real backend: **not tested** - nothing was listening on http://localhost:8000 when this
report was written (`curl http://localhost:8000/users` returned 000). `VITE_USE_MOCK`
was left at `true`.

How tests were run:

- `npm install` - OK (63 packages).
- `npm run build` - OK, no errors or warnings (`vite v5.4.21`, 50 modules, built in ~0.7s).
- `npm run dev` - OK, serving on http://localhost:5173.
- `node scripts/e2e-check.mjs` - Playwright (playwright-core driving installed Edge,
  headless) walked the real UI end to end. Full log in `scripts/e2e-results.json`:
  **34/34 checks passed**.

## Check table

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | `npm install` works | PASS | 63 packages installed |
| 2 | `npm run build` works, no errors/warnings | PASS | clean vite build output |
| 3 | `npm run dev` works | PASS | VITE ready on :5173 |
| 4a | Junior (Karthik, default): Home loads | PASS | hero headline + demo banner rendered |
| 4b | Search "Data" finds results | PASS | result count > 0, no empty state |
| 4c | Filter by semester, subject and type | PASS | selects narrow the list; combined filters render |
| 4d | Empty search shows empty state | PASS | "No resources match these filters..." shown |
| 4e | Open a resource, details page | PASS | title, Verified badge, metadata shown |
| 4f | Download works | PASS | browser download event fired, suggested filename `dbdm-lecture-notes.pdf` |
| 4g | Save works, button shows Saved | PASS | "Saved" state shown, resource appears on Saved page |
| 4h | Second save shows "Already in your bookmarks." | NOT UI-VERIFIED | code path exists (`created:false` -> message) but the button is disabled after first save, so it cannot be triggered twice from the UI in one session; mock returns `{created:false}` correctly if called again |
| 4i | Upload / Review queue links hidden for junior | PASS | subbar contains only My uploads + Saved |
| 5a | Senior (Arun): valid PDF upload -> Pending review | PASS | "Submitted for review" + "Pending review" shown |
| 5b | `.exe` shows correct message | PASS | "File type .exe is not allowed. Use PDF, DOCX, PPTX, PNG or JPG." |
| 5c | Empty file shows correct message | PASS | "The file is empty. Choose a file with content." |
| 5d | >10 MB file shows correct message | PASS | "File is too large (11.2 MB). The limit is 10 MB." (tested with an 11.2 MB file) |
| 5e | Missing title shows correct message | PASS | "Title is required." |
| 5f | Same file again -> duplicate message | PASS | `This file was already uploaded as "E2E test notes - linked lists deep dive".` |
| 5g | My uploads shows pending item | PASS | new upload listed with Pending review badge |
| 6a | Moderator (Priya): Review queue shows pending | PASS | both pending items listed (seed + new upload) |
| 6b | Reject without reason shows error | PASS | "Give a reason when rejecting." |
| 6c | Approve removes row, toast shown | PASS | row removed from queue; toast "Resource approved." |
| 6d | Approved resource appears in Explore as Verified | PASS | junior search found it with Verified badge |
| 7 | Layout 375px: no horizontal scroll, nav usable | PASS | scrollWidth=375 on home and library |
| 8 | Layout 1280px: no horizontal scroll, nav usable | PASS | scrollWidth=1280 on home and library |

## Not verified / notes

- Real-backend mode (`VITE_USE_MOCK=false`): backend was not running, so proxying,
  `X-User-Id` header behaviour and real error payloads could not be exercised.
  The code path is implemented per contract (blob download with Content-Disposition
  filename, `{"detail": ...}` and array-of-`msg` error parsing, unreachable-server
  message) but is untested against a live server.
- The "Already in your bookmarks." message is implemented but unreachable through the
  UI in a single session (the Save button disables after the first save); verified by
  code inspection only.
- Pages a role cannot use redirect to Home via the role guard in `App.jsx`; this was
  verified indirectly (junior never sees Upload/Review queue) but not by forcing
  navigation, since there is no URL router.
- `npm audit` reports 2 vulnerabilities (1 moderate, 1 high) in transitive dev
  dependencies of Vite/esbuild; not addressed since fixing would require breaking
  version changes and the app builds and runs cleanly.
