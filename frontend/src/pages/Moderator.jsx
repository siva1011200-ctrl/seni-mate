import { useEffect, useState } from 'react'
import { getPending, reviewResource } from '../services/api.js'
import ResourceRow from '../components/ResourceRow.jsx'
import { showToast } from '../services/toast.js'

export default function Moderator({ go }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPending()
      .then((res) => {
        if (cancelled) return
        setItems(res)
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
  }, [reloadKey])

  const decide = async (id, status, reason) => {
    setBusyId(id)
    setRejectError(null)
    try {
      await reviewResource(id, { status, reason })
      setItems((prev) => prev.filter((r) => r.id !== id))
      setRejectingId(null)
      setRejectReason('')
      showToast(status === 'approved' ? 'Resource approved.' : 'Resource rejected.')
    } catch (e) {
      setRejectError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const onApprove = (id) => decide(id, 'approved')

  const onConfirmReject = (id) => {
    if (!rejectReason.trim()) {
      setRejectError('Give a reason when rejecting.')
      return
    }
    decide(id, 'rejected', rejectReason.trim())
  }

  return (
    <div className="page page-narrow">
      <h1>Review queue</h1>
      <p className="page-sub">Uploads waiting for a moderator decision.</p>

      {error && (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {rejectError && (
        <div className="error-box" role="alert">
          {rejectError}
        </div>
      )}

      {loading && <p className="muted">Loading the review queue...</p>}

      {!error && !loading && items.length === 0 && (
        <div className="empty-box">
          <p>Nothing to review</p>
        </div>
      )}

      {!error && !loading && items.length > 0 && (
        <div className="resource-list">
          {items.map((r) => (
            <div key={r.id}>
              <ResourceRow resource={r} onOpen={(rid) => go('details', { id: rid })}>
                <span className="row-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    disabled={busyId === r.id}
                    onClick={() => onApprove(r.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    disabled={busyId === r.id}
                    onClick={() => {
                      setRejectingId(r.id)
                      setRejectReason('')
                      setRejectError(null)
                    }}
                  >
                    Reject
                  </button>
                </span>
              </ResourceRow>
              {rejectingId === r.id && (
                <div className="reject-box">
                  <label htmlFor={`reject-reason-${r.id}`}>Reason for rejecting</label>
                  <textarea
                    id={`reject-reason-${r.id}`}
                    rows="2"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Tell the uploader what is wrong with this file."
                  />
                  <div className="detail-actions">
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      disabled={busyId === r.id}
                      onClick={() => onConfirmReject(r.id)}
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => setRejectingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
