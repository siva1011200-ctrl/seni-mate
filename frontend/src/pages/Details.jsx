import { useEffect, useState } from 'react'
import { bookmarkResource, downloadResource, getResource, reportResource } from '../services/api.js'
import { TYPE_LABELS, formatDate } from '../services/format.js'
import StatusBadge from '../components/StatusBadge.jsx'

export default function Details({ params, back, go }) {
  const id = params.id
  const [resource, setResource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saveNote, setSaveNote] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDone, setReportDone] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getResource(id)
      .then((r) => {
        if (cancelled) return
        setResource(r)
        setSaved(r.is_bookmarked)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const onDownload = async () => {
    setActionError(null)
    try {
      await downloadResource(id)
    } catch (e) {
      setActionError(e.message)
    }
  }

  const onSave = async () => {
    setActionError(null)
    setSaveNote('')
    try {
      const res = await bookmarkResource(id)
      if (res && res.created === false) {
        setSaveNote('Already in your bookmarks.')
      } else {
        setSaved(true)
      }
    } catch (e) {
      setActionError(e.message)
    }
  }

  const onReport = async () => {
    setActionError(null)
    setReportDone('')
    try {
      await reportResource(id, reportReason)
      setReportDone('Thanks. Your report was sent to the moderators.')
      setReportOpen(false)
      setReportReason('')
    } catch (e) {
      setActionError(e.message)
    }
  }

  return (
    <div className="page page-narrow">
      <button type="button" className="btn btn-ghost" onClick={back}>
        Back
      </button>

      {loading && <p className="muted">Loading resource...</p>}

      {error && (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-ghost" onClick={() => go('library', {})}>
            Go to Explore Resources
          </button>
        </div>
      )}

      {resource && (
        <article className="detail-card">
          <div className="detail-head">
            <h1>{resource.title}</h1>
            <StatusBadge status={resource.status} />
          </div>

          {resource.status === 'pending' && (
            <div className="notice-box">
              This resource has not been reviewed yet. It is not verified.
            </div>
          )}
          {resource.status === 'rejected' && resource.reject_reason && (
            <div className="notice-box notice-rejected">
              Rejected: {resource.reject_reason}
            </div>
          )}

          <dl className="detail-grid">
            <div>
              <dt>Subject</dt>
              <dd>
                {resource.subject.code} {resource.subject.name}
              </dd>
            </div>
            <div>
              <dt>Semester</dt>
              <dd>Semester {resource.subject.semester}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{resource.subject.department}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{TYPE_LABELS[resource.resource_type] || resource.resource_type}</dd>
            </div>
            <div>
              <dt>Uploaded by</dt>
              <dd>{resource.uploader_name}</dd>
            </div>
            <div>
              <dt>Upload date</dt>
              <dd>{formatDate(resource.created_at)}</dd>
            </div>
            <div>
              <dt>Downloads</dt>
              <dd>{resource.download_count}</dd>
            </div>
            <div>
              <dt>File</dt>
              <dd>{resource.file_name}</dd>
            </div>
          </dl>

          {resource.description && <p className="detail-desc">{resource.description}</p>}

          {actionError && (
            <div className="error-box" role="alert">
              {actionError}
            </div>
          )}
          {saveNote && <p className="save-note">{saveNote}</p>}
          {reportDone && <p className="save-note">{reportDone}</p>}

          <div className="detail-actions">
            <button type="button" className="btn btn-primary" onClick={onDownload}>
              Download file
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSave}
              disabled={saved}
            >
              {saved ? 'Saved' : 'Save for later'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setReportOpen((o) => !o)}
            >
              Report a problem
            </button>
          </div>

          {reportOpen && (
            <div className="report-box">
              <label htmlFor="report-reason">What is wrong with this resource?</label>
              <textarea
                id="report-reason"
                rows="3"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Tell us what is wrong so a moderator can check it."
              />
              <div className="detail-actions">
                <button type="button" className="btn btn-primary" onClick={onReport}>
                  Send report
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setReportOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </article>
      )}
    </div>
  )
}
