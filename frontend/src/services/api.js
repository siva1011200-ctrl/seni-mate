// The ONLY file that talks to the backend (real or mock).
// Pages must call the functions exported here and nothing else.

import * as mock from './mockData.js'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// '/api' in dev (Vite proxies to localhost:8000).
// In production set VITE_API_URL to the backend origin, e.g.
// https://senimate-api.onrender.com  (no trailing slash, no /api suffix).
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')

let apiUserId = null

export function setApiUser(id) {
  apiUserId = id
}

function authHeaders(extra = {}) {
  return { 'X-User-Id': String(apiUserId ?? ''), ...extra }
}

async function parseError(res) {
  let detail = null
  try {
    const j = await res.json()
    detail = j && j.detail
  } catch {
    detail = null
  }
  if (Array.isArray(detail)) {
    throw new Error(detail.map((d) => (d && d.msg) || '').filter(Boolean).join(' '))
  }
  if (typeof detail === 'string' && detail) throw new Error(detail)
  throw new Error('Something went wrong. Please try again.')
}

async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
  let res
  try {
    res = await fetch(API_BASE + path, { method, body, headers: authHeaders(headers) })
  } catch {
    throw new Error('Cannot reach the server. Check that the backend is running.')
  }
  if (!res.ok) await parseError(res)
  return res
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function filenameFromDisposition(res) {
  const cd = res.headers.get('Content-Disposition') || ''
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)
  if (star) return decodeURIComponent(star[1].trim())
  const plain = /filename="?([^";]+)"?/i.exec(cd)
  return plain ? plain[1].trim() : 'download'
}

export async function getUsers() {
  if (USE_MOCK) return mock.mockGetUsers()
  const res = await apiFetch('/users')
  return res.json()
}

export async function getSubjects() {
  if (USE_MOCK) return mock.mockGetSubjects()
  const res = await apiFetch('/subjects')
  return res.json()
}

export async function getResources(filters = {}) {
  if (USE_MOCK) return mock.mockListResources(apiUserId, filters)
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, v)
  }
  const qs = params.toString()
  const res = await apiFetch('/resources' + (qs ? `?${qs}` : ''))
  return res.json()
}

export async function getResource(id) {
  if (USE_MOCK) return mock.mockGetResource(apiUserId, id)
  const res = await apiFetch(`/resources/${id}`)
  return res.json()
}

export async function downloadResource(id) {
  if (USE_MOCK) {
    const { fileName, text } = mock.mockDownload(apiUserId, id)
    saveBlob(new Blob([text], { type: 'text/plain' }), fileName)
    return { fileName }
  }
  const res = await apiFetch(`/resources/${id}/download`)
  const blob = await res.blob()
  saveBlob(blob, filenameFromDisposition(res))
  return { fileName: filenameFromDisposition(res) }
}

export async function uploadResource(formData) {
  if (USE_MOCK) return mock.mockUpload(apiUserId, formData)
  const res = await apiFetch('/resources', { method: 'POST', body: formData })
  return res.json()
}

export async function getMyUploads() {
  if (USE_MOCK) return mock.mockMyUploads(apiUserId)
  const res = await apiFetch('/my-uploads')
  return res.json()
}

export async function getPending() {
  if (USE_MOCK) return mock.mockPending(apiUserId)
  const res = await apiFetch('/pending')
  return res.json()
}

export async function getBookmarks() {
  if (USE_MOCK) return mock.mockBookmarks(apiUserId)
  const res = await apiFetch('/bookmarks')
  return res.json()
}

export async function reviewResource(id, { status, reason }) {
  if (USE_MOCK) return mock.mockReview(apiUserId, id, { status, reason })
  const res = await apiFetch(`/resources/${id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reason }),
  })
  return res.json()
}

export async function bookmarkResource(id) {
  if (USE_MOCK) return mock.mockBookmark(apiUserId, id)
  const res = await apiFetch(`/resources/${id}/bookmark`, { method: 'POST' })
  return res.json()
}

export async function reportResource(id, reason) {
  if (USE_MOCK) return mock.mockReport(apiUserId, id, { reason })
  const res = await apiFetch(`/resources/${id}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (res.status === 204) return null
  return res.json().catch(() => null)
}
