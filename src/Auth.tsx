import { ArrowRight, Eye, EyeOff, KeyRound, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { getSession, logIn, logOut, sessionEndedEvent, type AuthUser, type Session } from './api'

const loginHash = '#/login'
const dashboardHash = '#/dashboard'
const sessionNotice = 'Sesi berakhir. Silakan masuk kembali.'

function currentRoute() {
  const hash = window.location.hash
  return hash.startsWith('#/') && hash !== loginHash ? hash : dashboardHash
}

export function AuthGate({children}: {children: (user: AuthUser, onSignOut: () => Promise<void>) => ReactNode}) {
  const [session, setSession] = useState<Session | null>()
  const [checkError, setCheckError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState('')
  const nextRoute = useRef(currentRoute())
  const channel = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getSession(controller.signal).then(({session: active}) => {
      if (active && window.location.hash === loginHash) window.history.replaceState(null, '', nextRoute.current)
      setSession(active)
    }).catch((error: Error) => {
      if (!controller.signal.aborted) setCheckError(error.message)
    })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (session) return
    document.title = 'Masuk · Bank Soal Unpad'
    if (session === undefined) return
    function redirectToLogin() {
      if (window.location.hash === loginHash) return
      nextRoute.current = currentRoute()
      window.history.replaceState(null, '', loginHash)
      window.scrollTo(0, 0)
    }
    redirectToLogin()
    window.addEventListener('hashchange', redirectToLogin)
    return () => window.removeEventListener('hashchange', redirectToLogin)
  }, [session])

  useEffect(() => {
    if (!session) return
    function expire() {
      setNotice(sessionNotice)
      setSession(null)
    }
    const timer = window.setTimeout(expire, Math.max(0, Date.parse(session.expiresAt) - Date.now()))
    window.addEventListener(sessionEndedEvent, expire)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(sessionEndedEvent, expire)
    }
  }, [session])

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return
    const broadcast = new BroadcastChannel('bank-soal-auth')
    channel.current = broadcast
    broadcast.onmessage = (event) => {
      if (event.data === 'logout') {
        setNotice('Kamu sudah keluar dari Bank Soal.')
        setSession(null)
      }
    }
    return () => {
      broadcast.close()
      channel.current = null
    }
  }, [])

  async function signIn(username: string, password: string) {
    const result = await logIn(username, password)
    window.history.replaceState(null, '', nextRoute.current)
    setNotice('')
    setSession(result.session)
  }

  async function signOut() {
    await logOut()
    nextRoute.current = dashboardHash
    window.history.replaceState(null, '', loginHash)
    window.scrollTo(0, 0)
    setNotice('Kamu sudah keluar dari Bank Soal.')
    setSession(null)
    channel.current?.postMessage('logout')
  }

  if (session) return children(session.user, signOut)
  return <main className="auth-page">
    <div className="auth-shell">
      <div className="auth-brand">
        <img src="/unpad.png" width="74" height="74" alt="Lambang Universitas Padjadjaran" />
        <div className="auth-brand-copy">
          <p className="auth-university">Universitas Padjadjaran</p>
          <p className="auth-product">Bank Soal Unpad</p>
          <p className="auth-description">Ruang kerja untuk menyusun soal, meninjau draf, dan merakit paket ujian.</p>
        </div>
      </div>
      <section className="auth-content" aria-labelledby="auth-title">
        <div className="auth-form-wrap">
          <div className="auth-heading">
            <h1 id="auth-title">Masuk</h1>
            <p>Gunakan akun Bank Soal untuk melanjutkan.</p>
          </div>
          {checkError ? <>
            <p className="form-error" role="alert">{checkError}</p>
            <button type="button" className="button primary" onClick={() => {
              setSession(undefined)
              setCheckError('')
              setAttempt((value) => value + 1)
            }}>Coba Lagi</button>
          </> : session === undefined ? <p className="auth-status" role="status">Memeriksa sesi…</p>
            : <LoginForm onSignIn={signIn} notice={notice} />}
        </div>
      </section>
    </div>
  </main>
}

function LoginForm({onSignIn, notice}: {onSignIn: (username: string, password: string) => Promise<void>; notice: string}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError('')
    setPending(true)
    try {
      await onSignIn(username.trim(), password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Gagal masuk. Coba lagi.')
    } finally {
      setPending(false)
    }
  }

  return <form className="auth-form" onSubmit={submit} aria-busy={pending}>
    {notice && !error && <p className="auth-status" role="status">{notice}</p>}
    <div className="auth-field">
      <label htmlFor="login-username">Nama pengguna</label>
      <div className="auth-input">
        <UserRound size={18} aria-hidden="true" />
        <input id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
          required maxLength={40} value={username} onChange={(event) => {setUsername(event.target.value); setError('')}}
          placeholder="Masukkan nama pengguna" disabled={pending} />
      </div>
    </div>
    <div className="auth-field">
      <label htmlFor="login-password">Kata sandi</label>
      <div className="auth-input">
        <KeyRound size={18} aria-hidden="true" />
        <input id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password"
          required maxLength={1024} value={password} onChange={(event) => {setPassword(event.target.value); setError('')}}
          placeholder="Masukkan kata sandi" disabled={pending} />
        <button type="button" className="auth-reveal" aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="button primary auth-submit" disabled={pending}>
      {pending ? 'Sedang masuk…' : 'Masuk'} <ArrowRight size={18} aria-hidden="true" />
    </button>
  </form>
}
