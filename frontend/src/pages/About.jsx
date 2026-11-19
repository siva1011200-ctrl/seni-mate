export default function About() {
  return (
    <div className="page page-narrow">
      <h1>About SeniMate</h1>

      <section className="about-section">
        <h2>What SeniMate is</h2>
        <p>
          SeniMate is a campus knowledge-sharing platform. Seniors upload the notes, previous
          papers and preparation tips they kept during their semesters, and juniors search,
          download and save that material instead of starting from scratch.
        </p>
      </section>

      <section className="about-section">
        <h2>What Verified means</h2>
        <p>
          Every upload starts as Pending review. Only after a moderator approves it does a
          resource get the Verified badge and become visible in Explore Resources. Rejected
          uploads stay visible to their uploader with the moderator's reason so they can fix
          and resubmit.
        </p>
      </section>

      <section className="about-section">
        <h2>Current limits</h2>
        <ul>
          <li>This is a prototype built for a hackathon.</li>
          <li>Sign-in is a demo switcher - there is no real authentication yet.</li>
          <li>Uploaded files are stored on the server's local storage, not a cloud drive.</li>
        </ul>
      </section>
    </div>
  )
}
