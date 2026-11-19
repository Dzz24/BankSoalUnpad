import '@fontsource-variable/inter'
import { BarChart3, Bell, BookOpen, ChevronDown, ClipboardCheck, ClipboardList, FileBarChart2, History, LayoutDashboard, LogOut, Menu, Search, Settings as SettingsIcon, Upload, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { Analysis } from './Analysis'
import { getWorkspace, reviewQuestion, savePackage, saveQuestion, type AuthUser, type Workspace } from './api'
import { AuthGate } from './Auth'
import { Dashboard } from './Dashboard'
import { AuditLog } from './History'
import { QuestionBank, QuestionDialog, QuestionEditor, Review } from './Questions'
import { seedImports, statusInfo, type ExamImport, type PackageInput, type Profile, type Question, type QuestionInput, type ReviewStatus } from './data'
import { Dialog, Empty, StatusPill } from './ui'
import { Packages, Reports, Results, Settings } from './WorkspacePages'
import './styles.css'

const navigation: Array<{path: string; title: string; icon: LucideIcon}> = [
  {path: 'dashboard', title: 'Dashboard', icon: LayoutDashboard},
  {path: 'bank-soal', title: 'Bank Soal', icon: BookOpen},
  {path: 'review-soal', title: 'Review Soal', icon: ClipboardCheck},
  {path: 'paket-ujian', title: 'Paket Ujian', icon: ClipboardList},
  {path: 'hasil-ujian', title: 'Hasil Ujian', icon: Upload},
  {path: 'analisis-kualitas', title: 'Analisis Kualitas', icon: BarChart3},
  {path: 'laporan', title: 'Laporan', icon: FileBarChart2},
]

const getLocation = () => window.location.hash.slice(1).replace(/^\//, '') || 'dashboard'

function useLocalState<T,>(key: string, fallback: T) {
  const fullKey = 'bank-soal-unpad:v1:' + key
  const [value, setValue] = useState<T>(() => {
    try {
      const cached = localStorage.getItem(fullKey)
      return cached ? JSON.parse(cached) as T : fallback
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(fullKey, JSON.stringify(value))
    } catch {
      // The current session can keep working if persistent storage is unavailable.
    }
  }, [fullKey, value])
  return [value, setValue] as const
}

function SearchDialog({questions, onClose, onOpen}: {questions: Question[]; onClose: () => void; onOpen: (id: string) => void}) {
  const [query, setQuery] = useState('')
  const term = query.trim().toLocaleLowerCase('id')
  const matches = questions.filter((item) => [item.title, item.course, item.id, item.topic, item.stem].join(' ').toLocaleLowerCase('id').includes(term)).slice(0, 5)

  function submit(event: FormEvent) {
    event.preventDefault()
    onClose()
    window.location.hash = `/bank-soal?q=${encodeURIComponent(query.trim())}`
  }

  return <Dialog title="Cari Soal" onClose={onClose}>
    <div className="dialog-content">
      <form className="filter-row" onSubmit={submit}>
        <label className="search-field grow"><Search size={17} /><input autoFocus type="search" aria-label="Pencarian global" placeholder="Cari judul, mata kuliah, atau ID soal" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <button className="button primary">Cari</button>
      </form>
      {matches.length ? <ul className="dialog-results">{matches.map((item) => <li key={item.id}><button className="activity-row" onClick={() => onOpen(item.id)}><span className="activity-title"><strong>{item.title}</strong><small>{item.id} · {item.course}</small></span><StatusPill status={item.status} /></button></li>)}</ul>
        : <Empty title="Soal tidak ditemukan" description="Coba judul, mata kuliah, atau ID lain." />}
    </div>
  </Dialog>
}

function App({user, onSignOut}: {user: AuthUser; onSignOut: () => Promise<void>}) {
  const [location, setLocation] = useState(getLocation)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const questions = workspace?.questions ?? []
  const [imports, setImports] = useLocalState('imports', seedImports)
  const [profile, setProfile] = useLocalState<Profile>('profile:' + user.username, {name: user.name, faculty: 'FMIPA'})
  const [overlay, setOverlay] = useState<'search' | 'notifications' | 'profile' | null>(null)
  const [detail, setDetail] = useState<{id: string; review: boolean} | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const [path, query = ''] = location.split('?')
  const params = new URLSearchParams(query)
  const known = navigation.find((item) => item.path === path)
  const page = known?.path ?? (['buat-soal', 'pengaturan', 'audit-log'].includes(path) ? path : 'dashboard')
  const activeNav = page === 'buat-soal' ? 'bank-soal' : page
  const extraTitles: Record<string, string> = {'buat-soal': 'Buat Soal', pengaturan: 'Pengaturan Sistem', 'audit-log': 'Audit Log'}
  const title = known?.title ?? extraTitles[page] ?? 'Dashboard'
  const reviewQueue = questions.filter((question) => question.status === 'review')
  const currentDetail = detail ? questions.find((question) => question.id === detail.id) : undefined
  const editingId = params.get('id')
  const editing = questions.find((question) => question.id === editingId && ['draft', 'revision'].includes(question.status))
  const initials = profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

  useEffect(() => {
    const controller = new AbortController()
    getWorkspace(controller.signal).then(setWorkspace).catch((reason: Error) => {
      if (!controller.signal.aborted) setLoadError(reason.message)
    })
    return () => controller.abort()
  }, [loadAttempt])

  useEffect(() => {
    const onHash = () => {
      setLocation(getLocation())
      setMobileNav(false)
      setOverlay(null)
      setDetail(null)
      window.scrollTo({top: 0, behavior: 'instant'})
      window.requestAnimationFrame(() => document.getElementById('page-title')?.focus({preventScroll: true}))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {document.title = `${title} · Bank Soal Unpad`}, [title])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setDetail(null)
        setOverlay('search')
      }
      if (event.key === 'Escape') setMobileNav(false)
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  function openQuestion(id: string, review = false) {
    setOverlay(null)
    setDetail({id, review})
  }

  function applyQuestion(question: Question) {
    setWorkspace((previous) => {
      if (!previous) return previous
      const latest = previous.questions.find((item) => item.id === question.id)
      if (latest && latest.revision > question.revision) return previous
      const questions = [question, ...previous.questions.filter((item) => item.id !== question.id)]
      return {...previous, questions}
    })
  }

  async function submitQuestion(input: QuestionInput, id: string, revision?: number) {
    const question = await saveQuestion(id, input, revision)
    applyQuestion(question)
    setToast(question.status === 'review' ? 'Soal diajukan untuk review.' : 'Draf soal disimpan.')
    if (params.has('batch') && question.status === 'draft') return
    window.location.hash = '/bank-soal'
  }

  function acceptGeneratedQuestions(drafts: Question[]) {
    setWorkspace((previous) => previous && ({...previous, questions: [...drafts, ...previous.questions]}))
    setToast(`${drafts.length} draf AI disimpan. Periksa setiap soal sebelum mengajukan review.`)
    window.location.hash = '/buat-soal?' + new URLSearchParams({id: drafts[0].id, batch: drafts.map(({id}) => id).join(',')})
  }

  async function decide(question: Question, status: ReviewStatus, note: string) {
    const updated = await reviewQuestion(question.id, question.revision, status, note)
    applyQuestion(updated)
    setDetail(null)
    setToast(`Keputusan review disimpan · ${statusInfo[status].label}.`)
  }

  async function addPackage(input: PackageInput) {
    const item = await savePackage(input)
    setWorkspace((previous) => previous && {
      ...previous,
      packages: [item, ...previous.packages.filter((current) => current.id !== item.id)],
    })
    setToast('Paket ujian disimpan.')
  }

  function addImport(item: ExamImport) {
    setImports((previous) => [item, ...previous])
    setToast('Riwayat impor disimpan.')
  }

  async function signOut() {
    if (signingOut) return
    setSignOutError('')
    setSigningOut(true)
    try {
      await onSignOut()
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Gagal keluar. Coba lagi.')
    } finally {
      setSigningOut(false)
    }
  }

  return <div className="app">
    <header className="topbar">
      <div className="topbar-brand">
        <button type="button" className="icon-button mobile-toggle" aria-label={mobileNav ? 'Tutup navigasi' : 'Buka navigasi'} aria-expanded={mobileNav} aria-controls="sidebar" onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? <X size={22} /> : <Menu size={22} />}</button>
        <a className="brand" href="#/dashboard" onClick={() => setMobileNav(false)}>
          <img src="/unpad.png" width="42" height="46" alt="" />
          <span><strong>Bank Soal Unpad</strong><small>Universitas Padjadjaran</small></span>
        </a>
      </div>
      <div className="topbar-actions">
        <button type="button" className="global-search" onClick={() => setOverlay('search')} aria-label="Buka pencarian soal"><Search size={17} /><span>Cari soal</span><kbd>Ctrl K</kbd></button>
        <button type="button" className="icon-button notification-button" aria-label={`Pemberitahuan, ${reviewQueue.length} soal menunggu review`} onClick={() => setOverlay('notifications')}><Bell size={20} />{reviewQueue.length > 0 && <span className="notification-dot" />}</button>
        <button type="button" className="profile" aria-label="Buka profil akun" onClick={() => {setSignOutError(''); setOverlay('profile')}}><span className="avatar">{initials}</span><span className="profile-copy"><strong>{profile.name}</strong><small>@{user.username}</small></span><ChevronDown size={16} className="profile-chevron" /></button>
      </div>
    </header>

    {mobileNav && <button type="button" tabIndex={-1} aria-hidden="true" className="mobile-overlay" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar${mobileNav ? ' sidebar-open' : ''}`} id="sidebar">
      <nav aria-label="Menu utama">
        {navigation.map(({path, title, icon: Icon}) => <a key={path} href={`#/${path}`} className="nav-link" aria-current={activeNav === path ? 'page' : undefined} onClick={() => setMobileNav(false)}>
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" /><span>{title}</span>
          {path === 'review-soal' && reviewQueue.length > 0 && <span className="nav-count">{reviewQueue.length}</span>}
        </a>)}
      </nav>
      <nav className="settings-nav" aria-label="Administrasi">
        <span className="nav-section">Administrasi</span>
        <a href="#/audit-log" className="nav-link" aria-current={activeNav === 'audit-log' ? 'page' : undefined} onClick={() => setMobileNav(false)}><History size={19} strokeWidth={1.8} /><span>Audit Log</span></a>
        <a href="#/pengaturan" className="nav-link" aria-current={activeNav === 'pengaturan' ? 'page' : undefined} onClick={() => setMobileNav(false)}><SettingsIcon size={19} strokeWidth={1.8} /><span>Pengaturan Sistem</span></a>
      </nav>
      <div className="sidebar-footer"><span className="status-dot" /> Data demo</div>
    </aside>

    <main className="main" aria-labelledby={workspace ? 'page-title' : undefined} key={location}>
      {loadError && <section className="card" aria-label="Status backend"><Empty title="Data Bank Soal belum bisa dimuat" description={loadError}
        action={<button className="button secondary" onClick={() => {setLoadError(''); setLoadAttempt(loadAttempt + 1)}}>Coba Lagi</button>} /></section>}
      {!workspace && !loadError && <p className="loading-state" role="status">Memuat data Bank Soal…</p>}
      {workspace && <>
      {page === 'dashboard' && <Dashboard questions={questions} onOpen={openQuestion} />}
      {page === 'bank-soal' && <QuestionBank questions={questions} params={params} onOpen={openQuestion} />}
      {page === 'review-soal' && <Review questions={questions} onOpen={openQuestion} />}
      {page === 'buat-soal' && (editingId && !editing
        ? <Empty title="Soal tidak tersedia untuk diedit" description="Pilih soal berstatus draf atau perlu revisi." action={<a className="button secondary" href="#/bank-soal">Kembali ke Bank Soal</a>} />
        : <QuestionEditor question={editing} onSave={submitQuestion} onGenerated={acceptGeneratedQuestions}
          batchQuestions={(params.get('batch') ?? '').split(',').map((id) => questions.find((item) => item.id === id && ['draft', 'revision'].includes(item.status))).filter((item): item is Question => Boolean(item))} />)}
      {page === 'analisis-kualitas' && <Analysis />}
      {page === 'paket-ujian' && <Packages packages={workspace.packages} questions={questions} initialOpen={params.has('baru')} onAdd={addPackage} />}
      {page === 'hasil-ujian' && <Results imports={imports} initialOpen={params.has('impor')} onAdd={addImport} />}
      {page === 'laporan' && <Reports questions={questions} />}
      {page === 'pengaturan' && <Settings profile={profile} onSave={(next) => {setProfile(next); setToast('Pengaturan disimpan.')}} />}
      {page === 'audit-log' && <AuditLog />}
      </>}
    </main>

    {overlay === 'search' && <SearchDialog questions={questions} onClose={() => setOverlay(null)} onOpen={openQuestion} />}
    {overlay === 'notifications' && <Dialog title="Pemberitahuan" onClose={() => setOverlay(null)}>
      <div className="dialog-content">
        {reviewQueue.length ? <><p className="muted">{reviewQueue.length} soal menunggu pemeriksaan.</p>
          <ul className="dialog-results">{reviewQueue.slice(0, 5).map((question) => <li key={question.id}><button className="activity-row" onClick={() => openQuestion(question.id, true)}><span className="activity-title"><strong>{question.title}</strong><small>{question.course}</small></span><StatusPill status="review" /></button></li>)}</ul>
        </> : <Empty title="Antrean review kosong" description="Pemberitahuan muncul saat ada soal yang diajukan." />}
      </div>
      <footer className="dialog-footer"><a className="button primary" href="#/review-soal" onClick={() => setOverlay(null)}>Buka Review Soal</a></footer>
    </Dialog>}
    {overlay === 'profile' && <Dialog title="Profil Akun" onClose={() => setOverlay(null)}>
      <div className="dialog-content profile-detail"><span className="avatar">{initials}</span><div><h3>{profile.name}</h3><p className="muted">@{user.username} · {profile.faculty}</p></div>
        {signOutError && <p className="form-error sign-out-error" role="alert">{signOutError}</p>}
      </div>
      <footer className="dialog-footer">
        <a className="button secondary" href="#/pengaturan" onClick={() => setOverlay(null)}><SettingsIcon size={17} /> Pengaturan Profil</a>
        <button type="button" className="button danger" disabled={signingOut} onClick={() => void signOut()}><LogOut size={17} /> {signingOut ? 'Sedang keluar…' : 'Keluar'}</button>
      </footer>
    </Dialog>}
    {currentDetail && detail && <QuestionDialog key={currentDetail.id} question={currentDetail} review={detail.review} onClose={() => setDetail(null)} onDecision={decide} />}
    <div className="toast-area" aria-live="polite">{toast && <div className="toast"><span>{toast}</span><button type="button" aria-label="Tutup pesan" onClick={() => setToast('')}><X size={17} /></button></div>}</div>
  </div>
}

createRoot(document.getElementById('root')!).render(
  <AuthGate>{(user, signOut) => <App key={user.username} user={user} onSignOut={signOut} />}</AuthGate>,
)
