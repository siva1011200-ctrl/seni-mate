import { useEffect, useState } from 'react'
import { getResources } from '../services/api.js'
import ResourceRow from '../components/ResourceRow.jsx'

export default function Connect({ go }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getResources({ resource_type: 'tips' })
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
      <h1>Senior Connect</h1>
      <p className="page-sub">
        Advice and preparation tips written by seniors who already took these subjects. Only
        tips approved by a moderator appear here.
      </p>

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

      {loading && <p className="muted">Loading tips...</p>}

      {!error && !loading && items.length === 0 && (
        <div className="empty-box">
          <p>No tips shared yet.</p>
        </div>
      )}

      {!error && !loading && items.length > 0 && (
        <div className="resource-list">
          {items.map((r) => (
            <ResourceRow key={r.id} resource={r} onOpen={(id) => go('details', { id })} />
          ))}
        </div>
      )}
    </div>
  )
}
