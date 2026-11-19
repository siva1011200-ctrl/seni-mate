import { useEffect, useState } from 'react'
import { getSubjects, uploadResource } from '../services/api.js'

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'png', 'jpg']
const MAX_BYTES = 10 * 1024 * 1024

function validate(title, description, type, subjectId, file) {
  if (!title.trim()) return 'Title is required.'
  if (!type) return 'Choose a resource type.'
  if (!subjectId) return 'Choose a subject.'
  if (!file) return 'Choose a file to upload.'
  if (file.size === 0) return 'The file is empty. Choose a file with content.'
  const name = file.name || ''
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `File type .${ext} is not allowed. Use PDF, DOCX, PPTX, PNG or JPG.`
  }
  if (file.size > MAX_BYTES) {
    return `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). The limit is 10 MB.`
  }
  return null
}

export default function Upload({ go }) {
  const [subjects, setSubjects] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => {
    let cancelled = false
    getSubjects()
      .then((s) => !cancelled && setSubjects(s))
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setType('')
    setSubjectId('')
    setFile(null)
    setFileName('')
    setError(null)
    const input = document.getElementById('upload-file')
    if (input) input.value = ''
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const clientError = validate(title, description, type, subjectId, file)
    if (clientError) {
      setError(clientError)
      return
    }
    setSubmitting(true)
    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('description', description)
    fd.append('resource_type', type)
    fd.append('subject_id', subjectId)
    fd.append('file', file)
    try {
      const res = await uploadResource(fd)
      setDone(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="page page-narrow">
        <div className="success-box">
          <h1>Submitted for review</h1>
          <p>
            "{done.title}" was uploaded with status Pending review. A moderator must approve it
            before juniors can see and download it.
          </p>
          <div className="detail-actions">
            <button type="button" className="btn btn-primary" onClick={() => go('my-uploads')}>
              View my uploads
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                resetForm()
                setDone(null)
              }}
            >
              Upload another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page page-narrow">
      <h1>Upload a resource</h1>
      <p className="page-sub">
        Share notes, a previous paper or preparation tips. Files up to 10 MB: PDF, DOCX, PPTX,
        PNG or JPG.
      </p>

      <form className="form-card" onSubmit={onSubmit}>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        <div className="form-field">
          <label htmlFor="up-title">Title</label>
          <input
            id="up-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. DBMS Unit 4 notes"
          />
        </div>

        <div className="form-field">
          <label htmlFor="up-desc">Description (optional)</label>
          <textarea
            id="up-desc"
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is inside this file? Anything juniors should know?"
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="up-type">Type</label>
            <select id="up-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Choose a type</option>
              <option value="notes">Notes</option>
              <option value="previous_paper">Previous paper</option>
              <option value="tips">Tips</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="up-subject">Subject</label>
            <select
              id="up-subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">Choose a subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} {s.name} (semester {s.semester}, {s.department})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="upload-file">File</label>
          <input
            id="upload-file"
            type="file"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0]
              setFile(f || null)
              setFileName(f ? f.name : '')
            }}
          />
          {fileName && <p className="file-note">Selected: {fileName}</p>}
        </div>

        <div className="detail-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Uploading...' : 'Submit for review'}
          </button>
        </div>
      </form>
    </div>
  )
}
