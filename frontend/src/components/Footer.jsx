import Logo from './Logo.jsx'

export default function Footer({ go }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">
            <Logo dark />
            <span>SeniMate</span>
          </div>
          <p className="footer-tagline">Knowledge passed forward, bonds built together.</p>
        </div>
        <nav className="footer-col" aria-label="Explore">
          <h3>Explore</h3>
          <button type="button" onClick={() => go('library')}>Explore Resources</button>
          <button type="button" onClick={() => go('connect')}>Senior Connect</button>
          <button type="button" onClick={() => go('about')}>About</button>
        </nav>
        <nav className="footer-col" aria-label="Your account">
          <h3>Your account</h3>
          <button type="button" onClick={() => go('upload')}>Upload</button>
          <button type="button" onClick={() => go('my-uploads')}>My uploads</button>
          <button type="button" onClick={() => go('bookmarks')}>Saved</button>
        </nav>
        <nav className="footer-col" aria-label="Info">
          <h3>Info</h3>
          <button type="button" onClick={() => go('about')}>What is SeniMate</button>
          <button type="button" onClick={() => go('connect')}>Tips from seniors</button>
        </nav>
      </div>
      <p className="footer-credit">Built at IT HAPPENS @ RAALE #14, Rathinam Technical Campus.</p>
    </footer>
  )
}
