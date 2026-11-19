import { TYPE_LABELS, formatDate } from '../services/format.js'
import StatusBadge from './StatusBadge.jsx'

export default function ResourceRow({ resource, onOpen, children }) {
  const r = resource
  return (
    <article className="resource-row">
      <span className={`row-accent row-accent-${r.resource_type}`} aria-hidden="true" />
      <div className="row-main">
        <button type="button" className="row-title" onClick={() => onOpen(r.id)}>
          {r.title}
        </button>
        <div className="row-subject">
          {r.subject.code} {r.subject.name}, semester {r.subject.semester}
        </div>
        <div className="row-meta">
          <span className="row-type">{TYPE_LABELS[r.resource_type] || r.resource_type}</span>
          <span>Uploaded by {r.uploader_name}</span>
          <span>{formatDate(r.created_at)}</span>
          <span>{r.download_count} downloads</span>
        </div>
      </div>
      <div className="row-side">
        <StatusBadge status={r.status} />
        {children}
      </div>
    </article>
  )
}
