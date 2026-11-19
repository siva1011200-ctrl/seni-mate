import { useEffect, useMemo, useState } from 'react'
import { getResources, getSubjects } from '../services/api.js'
import ResourceRow from '../components/ResourceRow.jsx'

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'notes', label: 'Notes' },
  { value: 'previous_paper', label: 'Previous paper' },
  { value: 'tips', label: 'Tips' },
]

export default function Library({ params = {}, go }) {
  const [subjects, setSubjects] = useState([])
  const [q, setQ] = useState(params.q || '')
  const [debouncedQ, setDebouncedQ] = useState(params.q || '')
  const [department, setDepartment] = useState(params.department || '')
  const [semester, setSemester] = useState(params.semester ? String(params.semester) : '')
  const [subjectId, setSubjectId] = useState(params.subject_id ? String(params.subject_id) : '')
  const [type, setType] = useState(params.resource_type || '')
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let cancelled = false
    getSubjects()
      .then((s) => !cancelled && setSubjects(s))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const departments = useMemo(
    () => [...new Set(subjects.map((s) => s.department))].sort(),
    [subjects],
  )
  const semesters = useMemo(() => {
    const list = subjects.filter((s) => !department || s.department === department)
    return [...new Set(list.map((s) => s.semester))].sort((a, b) => a - b)
  }, [subjects, department])
  const subjectOptions = useMemo(
    () =>
      subjects.filter(
        (s) =>
          (!department || s.department === department) &&
          (!semester || s.semester === Number(semester)),
      ),
    [subjects, department, semester],
  )

  const filters = {
    q: debouncedQ,
    department,
    semester,
    subject_id: subjectId,
    resource_type: type,
  }
  const anyFilter = Boolean(debouncedQ || department || semester || subjectId || type)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getResources(filters)
      .then((res) => {
        if (cancelled) return
        setResources(res)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, department, semester, subjectId, type, reloadKey])

  const clearFilters = () => {
    setQ('')
    setDebouncedQ('')
    setDepartment('')
    setSemester('')
    setSubjectId('')
    setType('')
  }

  return (
    <div className="page page-narrow">
      <h1>Explore Resources</h1>
      <p className="page-sub">Search notes, previous papers and tips shared by seniors.</p>

      <div className="filter-bar">
        <div className="filter-field filter-search">
          <label htmlFor="lib-q">Keyword</label>
          <input
            id="lib-q"
            type="search"
            placeholder="Search by title, subject or keyword"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="lib-dept">Department</label>
          <select
            id="lib-dept"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value)
              setSemester('')
              setSubjectId('')
            }}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="lib-sem">Semester</label>
          <select
            id="lib-sem"
            value={semester}
            onChange={(e) => {
              setSemester(e.target.value)
              setSubjectId('')
            }}
          >
            <option value="">All semesters</option>
            {semesters.map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="lib-subject">Subject</label>
          <select
            id="lib-subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">All subjects</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="lib-type">Type</label>
          <select id="lib-type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="results-bar">
        {anyFilter ? (
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>
            Clear filters
          </button>
        ) : (
          <span />
        )}
        <span className="results-count">
          {loading ? 'Searching...' : `${resources.length} resources found`}
        </span>
      </div>

      {error && (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-ghost" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      {!error && loading && <p className="muted">Loading resources...</p>}

      {!error && !loading && resources.length === 0 && (
        <div className="empty-box">
          <p>
            {anyFilter
              ? 'No resources match these filters. Remove a filter or try a shorter keyword.'
              : 'No approved resources yet.'}
          </p>
        </div>
      )}

      {!error && !loading && resources.length > 0 && (
        <div className="resource-list">
          {resources.map((r) => (
            <ResourceRow key={r.id} resource={r} onOpen={(id) => go('details', { id })} />
          ))}
        </div>
      )}
    </div>
  )
}
