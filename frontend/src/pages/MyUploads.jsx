import { useEffect, useState } from 'react'
import { getMyUploads } from '../services/api.js'
import ResourceRow from '../components/ResourceRow.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function MyUploads({ user, go }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getMyUploads()
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

  return (
    <div className="page page-narrow">
      <h1>My uploads</h1>
      <p className="page-sub">Everything you have shared, including items still in review.</p>

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

      {loading && <p className="muted">Loading your uploads...</p>}

      {!error && !loading && items.length === 0 && (
        <div className="empty-box">
          <p>
            {user && user.role === 'junior'
              ? 'Seniors upload resources. You can save items from Explore Resources.'
              : "You haven't uploaded anything yet."}
          </p>
        </div>
      )}

      {!error && !loading && items.length > 0 && (
        <div className="resource-list">
          {items.map((r) => (
            <ResourceRow key={r.id} resource={r} onOpen={(id) => go('details', { id })}>
              <span className="row-extra">
                <StatusBadge status={r.status} />
                {r.status === 'rejected' && r.reject_reason && (
                  <span className="reject-reason">{r.reject_reason}</span>
                )}
              </span>
            </ResourceRow>
          ))}
        </div>
      )}
    </div>
  )
}
