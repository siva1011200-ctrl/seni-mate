import Logo from './Logo.jsx'

const LINKS = [
  { page: 'home', label: 'Home' },
  { page: 'library', label: 'Explore Resources' },
  { page: 'connect', label: 'Senior Connect' },
  { page: 'about', label: 'About' },
]

export default function TopBar({ users, user, onSelectUser, page, go }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button type="button" className="brand" onClick={() => go('home')} aria-label="SeniMate home">
          <Logo />
          <span className="brand-name">SeniMate</span>
        </button>
        <nav className="main-nav" aria-label="Main">
          {LINKS.map((l) => (
            <button
              key={l.page}
              type="button"
              className={page === l.page ? 'nav-link active' : 'nav-link'}
              onClick={() => go(l.page)}
            >
              {l.label}
            </button>
          ))}
        </nav>
        <div className="user-picker">
          <label htmlFor="user-select">Signed in as</label>
          <select
            id="user-select"
            value={user ? user.id : ''}
            onChange={(e) => onSelectUser(Number(e.target.value))}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}
