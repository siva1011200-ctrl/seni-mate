import { useCallback, useEffect, useState } from 'react'
import { getUsers, setApiUser, USE_MOCK } from './services/api.js'
import TopBar from './components/TopBar.jsx'
import SubBar from './components/SubBar.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import Library from './pages/Library.jsx'
import Details from './pages/Details.jsx'
import Upload from './pages/Upload.jsx'
import MyUploads from './pages/MyUploads.jsx'
import Moderator from './pages/Moderator.jsx'
import Saved from './pages/Saved.jsx'
import Connect from './pages/Connect.jsx'
import About from './pages/About.jsx'

function pageAllowed(page, user) {
  if (!user) return false
  if (page === 'upload') return user.role === 'senior' || user.role === 'moderator'
  if (page === 'moderator') return user.role === 'moderator'
  return true
}

export default function App() {
  const [users, setUsers] = useState([])
  const [user, setUser] = useState(null)
  const [bootError, setBootError] = useState(null)
  const [nav, setNav] = useState({ page: 'home', params: {} })
  const [history, setHistory] = useState([])
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let cancelled = false
    getUsers()
      .then((list) => {
        if (cancelled) return
        setUsers(list)
        const def = list.find((u) => u.role === 'junior') || list[0]
        setUser(def)
        setApiUser(def.id)
      })
      .catch((e) => !cancelled && setBootError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handler = (e) => {
      setToast(e.detail)
    }
    window.addEventListener('senimate-toast', handler)
    return () => window.removeEventListener('senimate-toast', handler)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const go = useCallback((page, params = {}) => {
    setNav((current) => {
      setHistory((h) => [...h, current])
      return { page, params }
    })
  }, [])

  const back = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setNav(prev)
      return h.slice(0, -1)
    })
  }, [])

  const selectUser = useCallback(
    (id) => {
      const u = users.find((x) => x.id === id)
      if (!u) return
      setUser(u)
      setApiUser(u.id)
      setHistory([])
      setNav({ page: 'home', params: {} })
    },
    [users],
  )

  if (bootError) {
    return (
      <div className="boot-error" role="alert">
        <h1>SeniMate could not load</h1>
        <p>{bootError}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }

  if (!user) {
    return <div className="boot-loading">Loading SeniMate...</div>
  }

  const page = pageAllowed(nav.page, user) ? nav.page : 'home'
  const params = page === nav.page ? nav.params : {}

  const pageProps = { user, params, go, back }
  const pages = {
    home: <Home {...pageProps} />,
    library: <Library {...pageProps} />,
    details: <Details {...pageProps} />,
    upload: <Upload {...pageProps} />,
    'my-uploads': <MyUploads {...pageProps} />,
    moderator: <Moderator {...pageProps} />,
    bookmarks: <Saved {...pageProps} />,
    connect: <Connect {...pageProps} />,
    about: <About />,
  }

  return (
    <div className="app">
      {USE_MOCK && (
        <div className="demo-banner" role="status">
          Demo mode: using built-in sample data.
        </div>
      )}
      <TopBar users={users} user={user} onSelectUser={selectUser} page={page} go={go} />
      <SubBar user={user} page={page} go={go} />
      <main className="main">{pages[page]}</main>
      <Footer go={go} />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
