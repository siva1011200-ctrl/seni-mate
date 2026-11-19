// In-memory fake backend for demo mode (VITE_USE_MOCK=true).
// Mirrors the API contract exactly, including error message strings.

const USERS = [
  { id: 1, name: 'Arun Kumar', role: 'senior', department: 'CSE' },
  { id: 2, name: 'Divya S', role: 'senior', department: 'AI&DS' },
  { id: 3, name: 'Karthik R', role: 'junior', department: 'CSE' },
  { id: 4, name: 'Meena P', role: 'junior', department: 'AI&DS' },
  { id: 5, name: 'Priya N', role: 'moderator', department: 'CSE' },
]

const SUBJECTS = [
  { id: 1, code: 'CS3301', name: 'Data Structures', semester: 3, department: 'CSE' },
  { id: 2, code: 'CS3351', name: 'Digital Principles and Computer Organization', semester: 3, department: 'CSE' },
  { id: 3, code: 'CS3492', name: 'Database Management Systems', semester: 4, department: 'CSE' },
  { id: 4, code: 'CS3401', name: 'Algorithms', semester: 4, department: 'CSE' },
  { id: 5, code: 'AD3391', name: 'Database Design and Management', semester: 3, department: 'AI&DS' },
  { id: 6, code: 'AD3491', name: 'Fundamentals of Data Science and Analytics', semester: 4, department: 'AI&DS' },
]

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'png', 'jpg']
const MAX_BYTES = 10 * 1024 * 1024

// Internal resource shape adds uploader_id and file_size; serialize() strips them.
let nextId = 100
let resources = [
  {
    id: 1,
    title: 'Data Structures complete notes - Units 1 to 4',
    description: 'Handwritten-style typed notes covering arrays, stacks, queues, linked lists and trees.',
    resource_type: 'notes',
    status: 'approved',
    subject_id: 1,
    uploader_id: 1,
    uploader_name: 'Arun Kumar',
    created_at: '2026-11-02T10:30:00.000Z',
    download_count: 14,
    file_name: 'ds-notes-units-1-4.pdf',
    file_size: 1820 * 1024,
    reject_reason: null,
  },
  {
    id: 2,
    title: 'DBMS previous paper - Nov 2025 attempt',
    description: 'Question paper with the marking scheme attached at the end.',
    resource_type: 'previous_paper',
    status: 'approved',
    subject_id: 3,
    uploader_id: 1,
    uploader_name: 'Arun Kumar',
    created_at: '2026-10-28T15:10:00.000Z',
    download_count: 31,
    file_name: 'dbms-previous-paper-nov2025.pdf',
    file_size: 640 * 1024,
    reject_reason: null,
  },
  {
    id: 3,
    title: 'How I cleared DBMS in two weeks - tips',
    description: 'Study plan, important topics and common exam traps shared after my fourth semester.',
    resource_type: 'tips',
    status: 'approved',
    subject_id: 3,
    uploader_id: 2,
    uploader_name: 'Divya S',
    created_at: '2026-11-08T09:05:00.000Z',
    download_count: 9,
    file_name: 'dbms-prep-tips.docx',
    file_size: 96 * 1024,
    reject_reason: null,
  },
  {
    id: 4,
    title: 'Database Design and Management lecture notes',
    description: 'Normalized notes for ER diagrams, functional dependencies and SQL basics.',
    resource_type: 'notes',
    status: 'approved',
    subject_id: 5,
    uploader_id: 2,
    uploader_name: 'Divya S',
    created_at: '2026-11-12T11:45:00.000Z',
    download_count: 6,
    file_name: 'dbdm-lecture-notes.pdf',
    file_size: 2210 * 1024,
    reject_reason: null,
  },
  {
    id: 5,
    title: 'Algorithms Unit 3 slides - greedy and dynamic programming',
    description: 'Slides from the Unit 3 lecture plus two solved examples.',
    resource_type: 'notes',
    status: 'pending',
    subject_id: 4,
    uploader_id: 2,
    uploader_name: 'Divya S',
    created_at: '2026-11-15T13:20:00.000Z',
    download_count: 0,
    file_name: 'algorithms-unit3-slides.pptx',
    file_size: 3500 * 1024,
    reject_reason: null,
  },
  {
    id: 6,
    title: 'Data Structures mid-term question bank',
    description: 'Scanned question bank from the previous three mid-terms.',
    resource_type: 'previous_paper',
    status: 'rejected',
    subject_id: 1,
    uploader_id: 1,
    uploader_name: 'Arun Kumar',
    created_at: '2026-10-20T08:00:00.000Z',
    download_count: 0,
    file_name: 'ds-question-bank-scan.pdf',
    file_size: 5400 * 1024,
    reject_reason: 'The scan is unreadable. Please upload a clearer copy.',
  },
]

const bookmarks = new Set() // `${userId}:${resourceId}`

function subjectOf(r) {
  const s = SUBJECTS.find((x) => x.id === r.subject_id)
  return s ? { ...s } : null
}

function serialize(r, userId) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    resource_type: r.resource_type,
    status: r.status,
    subject: subjectOf(r),
    uploader_name: r.uploader_name,
    created_at: r.created_at,
    download_count: r.download_count,
    file_name: r.file_name,
    is_bookmarked: bookmarks.has(`${userId}:${r.id}`),
    reject_reason: r.reject_reason,
  }
}

function fail(message) {
  throw new Error(message)
}

function findResource(id) {
  const r = resources.find((x) => x.id === Number(id))
  if (!r) fail('Resource not found.')
  return r
}

function canSee(r, user) {
  if (!user) return false
  if (user.role === 'moderator') return true
  if (r.status === 'approved') return true
  return r.uploader_id === user.id
}

function fmtMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1)
}

export function mockGetUsers() {
  return USERS.map((u) => ({ id: u.id, name: u.name, role: u.role, department: u.department }))
}

export function mockGetSubjects() {
  return SUBJECTS.map((s) => ({ ...s }))
}

export function mockListResources(userId, f = {}) {
  const user = USERS.find((u) => u.id === userId)
  let list = resources.filter((r) => {
    if (r.status !== 'approved') {
      // approved only, except own pending/rejected are not listed here either
      return false
    }
    if (f.q) {
      const q = String(f.q).toLowerCase()
      const subj = subjectOf(r)
      const hay = `${r.title} ${r.description} ${subj ? subj.name + ' ' + subj.code : ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (f.department && subjectOf(r).department !== f.department) return false
    if (f.semester !== undefined && f.semester !== '' && subjectOf(r).semester !== Number(f.semester)) return false
    if (f.subject_id && r.subject_id !== Number(f.subject_id)) return false
    if (f.resource_type && r.resource_type !== f.resource_type) return false
    return true
  })
  list = list.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return list.map((r) => serialize(r, userId))
}

export function mockGetResource(userId, id) {
  const user = USERS.find((u) => u.id === userId)
  const r = findResource(id)
  if (!canSee(r, user)) fail('You don\'t have access to this resource.')
  return serialize(r, userId)
}

export function mockDownload(userId, id) {
  const user = USERS.find((u) => u.id === userId)
  const r = findResource(id)
  if (!canSee(r, user)) fail('You don\'t have access to this resource.')
  r.download_count += 1
  return { fileName: r.file_name, text: `SeniMate demo file: ${r.title}\n(${r.file_name})` }
}

export function mockUpload(userId, formData) {
  const user = USERS.find((u) => u.id === userId)
  if (!user || (user.role !== 'senior' && user.role !== 'moderator')) {
    fail('Only seniors can upload resources.')
  }
  const title = (formData.get('title') || '').toString().trim()
  const description = (formData.get('description') || '').toString()
  const resourceType = (formData.get('resource_type') || '').toString()
  const subjectId = formData.get('subject_id')
  const file = formData.get('file')

  if (!title) fail('Title is required.')
  if (!['notes', 'previous_paper', 'tips'].includes(resourceType)) fail('Choose a resource type.')
  if (!subjectId) fail('Choose a subject.')
  if (!file || file.size === undefined) fail('Choose a file to upload.')
  if (file.size === 0) fail('The file is empty. Choose a file with content.')

  const name = file.name || ''
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    fail(`File type .${ext} is not allowed. Use PDF, DOCX, PPTX, PNG or JPG.`)
  }
  if (file.size > MAX_BYTES) {
    fail(`File is too large (${fmtMb(file.size)} MB). The limit is 10 MB.`)
  }
  const dup = resources.find((r) => r.file_name === name && r.file_size === file.size)
  if (dup) fail(`This file was already uploaded as "${dup.title}".`)

  const r = {
    id: nextId++,
    title,
    description,
    resource_type: resourceType,
    status: 'pending',
    subject_id: Number(subjectId),
    uploader_id: user.id,
    uploader_name: user.name,
    created_at: new Date().toISOString(),
    download_count: 0,
    file_name: name,
    file_size: file.size,
    reject_reason: null,
  }
  resources.push(r)
  return serialize(r, userId)
}

export function mockMyUploads(userId) {
  const user = USERS.find((u) => u.id === userId)
  return resources
    .filter((r) => r.uploader_id === user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((r) => serialize(r, userId))
}

export function mockPending(userId) {
  const user = USERS.find((u) => u.id === userId)
  if (!user || user.role !== 'moderator') fail('Only moderators can review resources.')
  return resources
    .filter((r) => r.status === 'pending')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((r) => serialize(r, userId))
}

export function mockBookmarks(userId) {
  const user = USERS.find((u) => u.id === userId)
  return resources
    .filter((r) => bookmarks.has(`${userId}:${r.id}`) && canSee(r, user))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((r) => serialize(r, userId))
}

export function mockReview(userId, id, payload = {}) {
  const user = USERS.find((u) => u.id === userId)
  if (!user || user.role !== 'moderator') fail('Only moderators can review resources.')
  const r = findResource(id)
  const status = payload.status
  if (!['approved', 'rejected'].includes(status)) fail('Choose a review decision.')
  if (status === 'rejected' && !(payload.reason || '').toString().trim()) {
    fail('Give a reason when rejecting.')
  }
  r.status = status
  r.reject_reason = status === 'rejected' ? payload.reason.toString().trim() : null
  return serialize(r, userId)
}

export function mockBookmark(userId, id) {
  const user = USERS.find((u) => u.id === userId)
  const r = findResource(id)
  if (!canSee(r, user)) fail('You don\'t have access to this resource.')
  const key = `${userId}:${r.id}`
  if (bookmarks.has(key)) return { created: false }
  bookmarks.add(key)
  return { created: true }
}

export function mockReport(userId, id, payload = {}) {
  const user = USERS.find((u) => u.id === userId)
  const r = findResource(id)
  if (!canSee(r, user)) fail('You don\'t have access to this resource.')
  if (!(payload.reason || '').toString().trim()) fail('Tell us what is wrong with this resource.')
  return { ok: true }
}
