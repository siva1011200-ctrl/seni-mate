import { useEffect, useState } from 'react'
import { getResources, getSubjects } from '../services/api.js'
import ResourceRow from '../components/ResourceRow.jsx'

const CHIPS = [
  { label: 'Data Structures', go: { q: 'Data Structures' } },
  { label: 'Database Management', go: { q: 'Database Management' } },
  { label: 'Previous papers', go: { resource_type: 'previous_paper' } },
  { label: 'Preparation tips', go: { resource_type: 'tips' } },
]

const STEPS = [
  { title: 'Seniors upload', text: 'Senior students share the notes, papers and tips they kept.' },
  { title: 'Moderators review', text: 'A moderator checks every upload before it goes live.' },
  { title: 'Juniors search', text: 'Underclassmen find material by subject, semester or keyword.' },
  { title: 'Download and save', text: 'Save useful resources and come back to them later.' },
]

export default function Home({ go }) {
  const [subjects, setSubjects] = useState([])
  const [newest, setNewest] = useState([])
  const [recent, setRecent] = useState([])
  const [q, setQ] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getSubjects(), getResources({})])
      .then(([subs, res]) => {
        if (cancelled) return
        setSubjects(subs)
        setNewest(res.slice(0, 3))
        setRecent(res.slice(0, 4))
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  const openLibrary = (filters) => go('library', filters)

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <h1>Every note and question paper your seniors kept, in one place.</h1>
            <p>
              Material marked Verified has been checked and approved by a moderator before it
              appears here.
            </p>
            <form
              className="hero-search"
              onSubmit={(e) => {
                e.preventDefault()
                openLibrary({ q })
              }}
            >
              <label className="sr-only" htmlFor="hero-search-input">
                Search resources
              </label>
              <input
                id="hero-search-input"
                type="search"
                placeholder="Search notes, papers, subjects..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </form>
            <div className="hero-chips">
              {CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className="chip"
                  onClick={() => openLibrary(c.go)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hero-cards" aria-hidden="true">
            {newest.map((r, i) => (
              <div key={r.id} className={`mini-card mini-card-${i + 1}`}>
                <div className="mini-card-type">{r.resource_type.replace('_', ' ')}</div>
                <div className="mini-card-title">{r.title}</div>
                <div className="mini-card-sub">
                  {r.subject.code}, semester {r.subject.semester}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Explore subjects</h2>
          <button type="button" className="btn btn-ghost" onClick={() => go('library', {})}>
            View all resources
          </button>
        </div>
        <div className="subject-grid">
          {subjects.slice(0, 8).map((s) => (
            <button
              key={s.id}
              type="button"
              className="subject-tile"
              onClick={() =>
                openLibrary({ department: s.department, semester: s.semester, subject_id: s.id })
              }
            >
              <span className="subject-code">{s.code}</span>
              <span className="subject-name">{s.name}</span>
              <span className="subject-meta">
                Semester {s.semester}, {s.department}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Recently uploaded</h2>
        </div>
        <div className="resource-list">
          {recent.map((r) => (
            <ResourceRow key={r.id} resource={r} onOpen={(id) => go('details', { id })} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>How SeniMate works</h2>
        </div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="step">
              <span className="step-num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
