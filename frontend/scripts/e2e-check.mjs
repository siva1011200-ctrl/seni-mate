// End-to-end smoke test for the SeniMate frontend against the REAL backend.
// Run: node scripts/e2e-check.mjs  (backend on :8000 and dev server on :5173
// must be running; the script reseeds the backend first via seed.py --reset)
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'http://localhost:5173'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND = path.join(__dirname, '..', '..', 'backend')
const DEMO = path.join(BACKEND, 'demo_files')

// Reseed the backend so every run starts from the same demo data.
const venvPy =
  process.platform === 'win32'
    ? path.join(BACKEND, '.venv', 'Scripts', 'python.exe')
    : path.join(BACKEND, '.venv', 'bin', 'python')
const py = fs.existsSync(venvPy) ? venvPy : process.platform === 'win32' ? 'python' : 'python3'
execFileSync(py, ['seed.py', '--reset'], { cwd: BACKEND, stdio: 'inherit' })

const pdfPath = path.join(DEMO, 'valid-notes.pdf')
const exePath = path.join(DEMO, 'program.exe')
const emptyPath = path.join(DEMO, 'empty.pdf')
const bigPath = path.join(DEMO, 'too-big.pdf')
const fakePath = path.join(DEMO, 'fake.pdf')

const results = []
function check(name, cond, extra = '') {
  results.push({ name, pass: !!cond })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`)
}

async function bodyText(page) {
  return page.locator('body').innerText()
}
async function has(page, s) {
  return (await bodyText(page)).includes(s)
}
async function selectUser(page, label) {
  await page.selectOption('#user-select', { label })
  await page.waitForTimeout(300)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))

try {
  // ---------- (a) Junior: Karthik is default ----------
  await page.goto(BASE, { waitUntil: 'networkidle' })
  check('Home loads with hero headline', await has(page, 'Every note and question paper your seniors kept'))
  check('No demo banner in real mode', !(await has(page, 'Demo mode: using built-in sample data.')))
  check('Default user is a junior', await has(page, 'Karthik R (junior)'))
  check('Subbar hides Upload for junior', !(await page.locator('.subbar').innerText()).includes('Upload'))
  check('Subbar hides Review queue for junior', !(await page.locator('.subbar').innerText()).includes('Review queue'))

  // hero search for "Data"
  await page.fill('#hero-search-input', 'Data')
  await page.click('.hero-search button[type=submit]')
  await page.waitForTimeout(800)
  let t = await bodyText(page)
  check('Search "Data" returns results', /\d+ resources found/.test(t) && !t.includes('No resources match'))

  // filters: semester, subject, type
  await page.selectOption('#lib-sem', '3')
  await page.waitForTimeout(700)
  t = await bodyText(page)
  check('Semester filter narrows results', /resources found/.test(t))
  await page.selectOption('#lib-subject', { index: 1 })
  await page.waitForTimeout(700)
  await page.selectOption('#lib-type', 'previous_paper')
  await page.waitForTimeout(700)
  t = await bodyText(page)
  check('Combined filters still render result list or empty state', /resources found|No resources match/.test(t))

  // gibberish -> empty state
  await page.fill('#lib-q', 'zzzznotathing')
  await page.waitForTimeout(800)
  check('Empty search shows empty state', await has(page, 'No resources match these filters. Remove a filter or try a shorter keyword.'))
  await page.click('text=Clear filters')
  await page.waitForTimeout(700)

  // open first resource
  await page.locator('.row-title').first().click()
  await page.waitForTimeout(600)
  t = await bodyText(page)
  check('Details page shows Verified badge', t.includes('Verified'))
  check('Details shows Download file and Save for later', t.includes('Download file') && t.includes('Save for later'))

  // download (real file via FileResponse)
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click('text=Download file'),
  ])
  check('Download file triggers a file download', !!download, download ? await download.suggestedFilename() : 'no download event')

  // save for later
  await page.click('text=Save for later')
  await page.waitForTimeout(400)
  t = await bodyText(page)
  check('Save for later marks Saved', t.includes('Saved'))

  // back to library, check Saved page
  await page.click('text=Back')
  await page.waitForTimeout(400)
  await page.click('.subbar-link:has-text("Saved")')
  await page.waitForTimeout(600)
  check('Saved page lists the bookmarked resource', (await bodyText(page)).includes('Database Design and Management'))

  // ---------- (b) Senior: Arun ----------
  await selectUser(page, 'Arun Kumar (senior)')
  check('Senior sees Upload link', (await page.locator('.subbar').innerText()).includes('Upload'))
  await page.click('.subbar-link:has-text("Upload")')
  await page.waitForTimeout(400)

  const UP_TITLE = 'E2E test notes - linked lists deep dive'
  async function fillUpload({ title = UP_TITLE, file = pdfPath } = {}) {
    await page.fill('#up-title', title)
    await page.selectOption('#up-type', 'notes')
    await page.selectOption('#up-subject', '1')
    await page.setInputFiles('#upload-file', file)
  }
  async function submitUpload() {
    await page.click('button[type=submit]:has-text("Submit for review")')
    await page.waitForTimeout(800)
  }

  // missing title
  await page.selectOption('#up-type', 'notes')
  await page.selectOption('#up-subject', '1')
  await page.setInputFiles('#upload-file', pdfPath)
  await submitUpload()
  check('Missing title error', await has(page, 'Title is required.'))

  // .exe
  await fillUpload({ title: 'exe test', file: exePath })
  await submitUpload()
  check('Exe rejected', await has(page, 'File type .exe is not allowed. Use PDF, DOCX, PPTX, PNG or JPG.'))

  // empty file
  await fillUpload({ title: 'empty test', file: emptyPath })
  await submitUpload()
  check('Empty file error', await has(page, 'The file is empty. Choose a file with content.'))

  // >10MB
  await fillUpload({ title: 'big test', file: bigPath })
  await submitUpload()
  check('Oversize file error', await has(page, 'File is too large (11.0 MB). The limit is 10 MB.'))

  // fake pdf (content mismatch)
  await fillUpload({ title: 'fake test', file: fakePath })
  await submitUpload()
  check('Fake pdf content mismatch', await has(page, 'The file content does not match its extension.'))

  // valid upload
  await fillUpload()
  await submitUpload()
  t = await bodyText(page)
  check('Valid upload shows Submitted for review', t.includes('Submitted for review') && t.includes('Pending review'))

  // duplicate same file (backend detects by hash)
  await page.click('text=Upload another')
  await page.waitForTimeout(300)
  await fillUpload({ title: 'duplicate attempt' })
  await submitUpload()
  check('Duplicate file error', await has(page, 'This file was already uploaded as "E2E test notes - linked lists deep dive".'))

  // My uploads shows pending item
  await page.click('.subbar-link:has-text("My uploads")')
  await page.waitForTimeout(600)
  t = await bodyText(page)
  check('My uploads shows new pending item', t.includes(UP_TITLE) && t.includes('Pending review'))

  // ---------- (c) Moderator: Priya ----------
  await selectUser(page, 'Priya N (moderator)')
  check('Moderator sees Review queue', (await page.locator('.subbar').innerText()).includes('Review queue'))
  await page.click('.subbar-link:has-text("Review queue")')
  await page.waitForTimeout(600)
  t = await bodyText(page)
  check('Review queue lists pending uploads', t.includes(UP_TITLE) && t.includes('Algorithms Unit 3 slides'))

  // reject without reason
  await page.locator('button:has-text("Reject")').first().click()
  await page.waitForTimeout(200)
  await page.locator('button:has-text("Confirm reject")').click()
  await page.waitForTimeout(400)
  check('Reject without reason shows error', await has(page, 'Give a reason when rejecting.'))
  await page.click('button:has-text("Cancel")')
  await page.waitForTimeout(200)

  // reject the seeded Algorithms slides with a reason
  // (the inline reason box is a sibling rendered after the row, not inside it)
  const slidesRow = page.locator('.resource-row', { hasText: 'Algorithms Unit 3 slides' })
  await slidesRow.locator('button:has-text("Reject")').click()
  await page.waitForTimeout(200)
  await page.locator('.reject-box textarea').fill('E2E reject reason: blurry pages')
  await page.locator('.reject-box button:has-text("Confirm reject")').click()
  await page.waitForTimeout(600)

  // approve the E2E upload
  const row = page.locator('.resource-row', { hasText: UP_TITLE })
  await row.locator('button:has-text("Approve")').click()
  await page.waitForTimeout(600)
  t = await bodyText(page)
  check('Approved row removed from queue', !t.includes(UP_TITLE))

  // ---------- rejected reason visible to uploader ----------
  await selectUser(page, 'Divya S (senior)')
  await page.click('.subbar-link:has-text("My uploads")')
  await page.waitForTimeout(600)
  t = await bodyText(page)
  check('Rejected item shows reason to uploader', t.includes('E2E reject reason: blurry pages'))

  // ---------- (d) Junior sees approved resource ----------
  await selectUser(page, 'Karthik R (junior)')
  await page.click('.nav-link:has-text("Explore Resources")')
  await page.waitForTimeout(400)
  await page.fill('#lib-q', 'linked lists deep dive')
  await page.waitForTimeout(800)
  t = await bodyText(page)
  check('Newly approved resource found in search', t.includes(UP_TITLE))
  const approvedRow = page.locator('.resource-row', { hasText: UP_TITLE })
  check('New resource shows Verified badge', (await approvedRow.innerText()).includes('Verified'))
  // rejected resource must NOT appear
  await page.fill('#lib-q', 'greedy and dynamic programming')
  await page.waitForTimeout(800)
  check('Rejected resource absent from library', !(await bodyText(page)).includes('Algorithms Unit 3 slides'))

  // ---------- viewport checks ----------
  for (const w of [375, 1280]) {
    await page.setViewportSize({ width: w, height: 800 })
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    check(`No horizontal scroll at ${w}px (home)`, scrollW <= w, `scrollWidth=${scrollW}`)
    await page.click('.nav-link:has-text("Explore Resources")')
    await page.waitForTimeout(600)
    const scrollW2 = await page.evaluate(() => document.documentElement.scrollWidth)
    check(`No horizontal scroll at ${w}px (library)`, scrollW2 <= w, `scrollWidth=${scrollW2}`)
    const navVisible = await page.locator('.main-nav').isVisible()
    check(`Navigation usable at ${w}px`, navVisible)
  }
} catch (e) {
  check('SCRIPT COMPLETED WITHOUT EXCEPTION', false, e.message)
  console.log(e.stack)
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
fs.writeFileSync(path.join(__dirname, 'e2e-results.json'), JSON.stringify(results, null, 2))
process.exit(failed.length ? 1 : 0)
