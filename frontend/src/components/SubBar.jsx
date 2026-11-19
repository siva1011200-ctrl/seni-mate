export default function SubBar({ user, page, go }) {
  if (!user) return null
  const links = [{ page: 'my-uploads', label: 'My uploads' }]
  if (user.role === 'senior' || user.role === 'moderator') {
    links.unshift({ page: 'upload', label: 'Upload' })
  }
  links.push({ page: 'bookmarks', label: 'Saved' })
  if (user.role === 'moderator') {
    links.push({ page: 'moderator', label: 'Review queue' })
  }
  return (
    <nav className="subbar" aria-label="Your account">
      <div className="subbar-inner">
        {links.map((l) => (
          <button
            key={l.page}
            type="button"
            className={page === l.page ? 'subbar-link active' : 'subbar-link'}
            onClick={() => go(l.page)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
