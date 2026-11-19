import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Eye, History, ListChecks, Plus, RotateCcw, Search, Sparkles, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { getDraftExample } from './api'
import { courses, formats, formatDate, levels, statusInfo, type Course, type Format, type Level, type Question, type QuestionFields, type QuestionInput, type ReviewStatus } from './data'
import { QuestionHistoryPanel } from './History'
import { QuestionGenerator } from './QuestionGenerator'
import { Dialog, Empty, PageHeading, Pill, StatusPill } from './ui'

const pageSize = 7
const defaultOptions = ['', '', '', '']

export function QuestionBank({questions, params, onOpen}: {questions: Question[]; params: URLSearchParams; onOpen: (id: string) => void}) {
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [course, setCourse] = useState('')
  const [format, setFormat] = useState('')
  const [faculty, setFaculty] = useState('')
  const [program, setProgram] = useState('')
  const [page, setPage] = useState(1)
  const query = term.trim().toLocaleLowerCase('id')
  const filtered = questions.filter((question) => {
    const searchable = [question.title, question.course, question.id, question.topic, question.stem].join(' ').toLocaleLowerCase('id')
    return searchable.includes(query) && (!status || question.status === status)
      && (!course || question.course === course) && (!format || question.format === format)
      && (!faculty || question.faculty === faculty) && (!program || question.program === program)
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const activePage = Math.min(page, totalPages)
  const start = (activePage - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)
  const hasFilters = Boolean(term || status || course || format || faculty || program)

  function reset() {
    setTerm('')
    setStatus('')
    setCourse('')
    setFormat('')
    setFaculty('')
    setProgram('')
    setPage(1)
  }

  return <>
    <PageHeading title="Bank Soal" description="Cari, filter, dan kelola koleksi soal berdasarkan mata kuliah."
      action={<a className="button primary" href="#/buat-soal"><Plus size={18} /> Buat Soal</a>} />

    <section className="card table-card">
      <div className="table-tools">
        <div className="panel-heading"><h2>Daftar Soal</h2><span className="muted">{filtered.length} soal ditemukan</span></div>
        <div className="filter-row">
          <label className="search-field grow"><Search size={17} /><input type="search" aria-label="Cari soal" placeholder="Cari judul, mata kuliah, atau ID soal" value={term} onChange={(event) => {setTerm(event.target.value); setPage(1)}} /></label>
          <select aria-label="Status" value={status} onChange={(event) => {setStatus(event.target.value); setPage(1)}}>
            <option value="">Semua Status</option>
            {Object.entries(statusInfo).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
          </select>
        </div>
        <div className="filter-row">
          <select aria-label="Fakultas" value={faculty} onChange={(event) => {setFaculty(event.target.value); setPage(1)}}>
            <option value="">Fakultas</option>
            {[...new Set(questions.map((question) => question.faculty))].map((value) => <option key={value}>{value}</option>)}
          </select>
          <select aria-label="Program studi" value={program} onChange={(event) => {setProgram(event.target.value); setPage(1)}}>
            <option value="">Program Studi</option>
            {[...new Set(questions.map((question) => question.program))].map((value) => <option key={value}>{value}</option>)}
          </select>
          <select aria-label="Mata kuliah" value={course} onChange={(event) => {setCourse(event.target.value); setPage(1)}}>
            <option value="">Mata Kuliah</option>{courses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select aria-label="Format soal" value={format} onChange={(event) => {setFormat(event.target.value); setPage(1)}}>
            <option value="">Format</option>{formats.map((item) => <option key={item}>{item}</option>)}
          </select>
          {hasFilters && <button className="button ghost compact" onClick={reset}><X size={15} /> Hapus filter</button>}
        </div>
      </div>

      {visible.length ? <>
        <div className="table-scroll" tabIndex={0} aria-label="Tabel daftar soal">
          <table>
            <thead><tr><th>Soal</th><th>Mata Kuliah</th><th>Format</th><th>Pemilik</th><th>Status</th><th>Tindakan</th></tr></thead>
            <tbody>
              {visible.map((question) => <tr key={question.id}>
                <th scope="row"><strong>{question.title}</strong><small className="long-id">{question.id} · v{question.version}</small></th>
                <td>{question.course}</td><td>{question.format}</td><td>{question.owner}</td>
                <td><StatusPill status={question.status} /></td>
                <td><button className="text-button" onClick={() => onOpen(question.id)} aria-label={`Detail ${question.title}`}>Detail <ArrowRight size={14} /></button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Menampilkan {start + 1}–{start + visible.length} dari {filtered.length} soal</span>
          <div className="pagination">
            <button className="icon-button" aria-label="Halaman sebelumnya" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}><ChevronLeft size={17} /></button>
            <span>{activePage} / {totalPages}</span>
            <button className="icon-button" aria-label="Halaman berikutnya" disabled={activePage === totalPages} onClick={() => setPage(activePage + 1)}><ChevronRight size={17} /></button>
          </div>
        </div>
      </> : <Empty title="Soal tidak ditemukan" description="Coba kata kunci lain atau ubah pilihan filter."
        action={hasFilters && <button className="button secondary" onClick={reset}>Hapus filter</button>} />}
    </section>
  </>
}

export function Review({questions, onOpen}: {questions: Question[]; onOpen: (id: string, review?: boolean) => void}) {
  const [tab, setTab] = useState<'review' | 'completed'>('review')
  const queue = questions.filter((question) => question.status === 'review')
  const revisions = questions.filter((question) => question.status === 'revision')
  const completed = questions.filter((question) => ['approved', 'revision', 'rejected'].includes(question.status))
  const visible = tab === 'review' ? queue : completed

  return <>
    <PageHeading title="Review Soal" description="Periksa kualitas dan kesesuaian soal sebelum digunakan." />
    <section className="metric-grid review-metrics" aria-label="Ringkasan review">
      {[{label: 'Menunggu Review', value: queue.length, tone: 'amber', Icon: Clock3}, {label: 'Disetujui', value: questions.filter((question) => question.status === 'approved').length, tone: 'green', Icon: ClipboardCheck}, {label: 'Dikembalikan', value: revisions.length, tone: 'red', Icon: RotateCcw}].map(({label, value, tone, Icon}) =>
        <div className="card metric compact-metric" key={label}><span className={`icon-tile tone-${tone}`}><Icon size={20} /></span><div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong></div></div>
      )}
    </section>
    <section className="card table-card">
      <div className="table-tools">
        <div className="panel-heading"><h2>{tab === 'review' ? 'Antrean Review' : 'Riwayat Review'}</h2></div>
        <div className="segmented" aria-label="Tampilan review">
          <button aria-pressed={tab === 'review'} onClick={() => setTab('review')}>Menunggu review</button>
          <button aria-pressed={tab === 'completed'} onClick={() => setTab('completed')}>Riwayat</button>
        </div>
      </div>
      {visible.length ? <div className="table-scroll" tabIndex={0} aria-label="Tabel review soal">
        <table>
          <thead><tr><th>Soal / Pengaju</th><th>Tanggal</th><th>{tab === 'review' ? 'Prioritas' : 'Status'}</th><th>Tindakan</th></tr></thead>
          <tbody>{visible.map((question) => <tr key={question.id}>
            <th scope="row"><strong>{question.title}</strong><small>{question.owner} · {question.program}</small></th>
            <td>{formatDate(question.updated)}</td>
            <td>{tab === 'review' ? <Pill tone={question.priority === 'Tinggi' ? 'red' : 'blue'}>{question.priority}</Pill> : <StatusPill status={question.status} />}</td>
            <td><button className="button secondary compact" onClick={() => onOpen(question.id, tab === 'review')}>{tab === 'review' ? 'Periksa' : 'Lihat keputusan'} <ArrowRight size={14} /></button></td>
          </tr>)}</tbody>
        </table>
      </div> : <Empty title="Belum ada soal di sini" description="Soal akan muncul saat statusnya sesuai dengan tampilan ini." />}
    </section>
    <div className="card guidance">
      <span className="icon-tile tone-blue"><ListChecks size={21} /></span>
      <div><h2>Panduan Pemeriksaan</h2><p>Periksa kejelasan pertanyaan, kebenaran kunci, kualitas pengecoh, dan kesesuaian materi.</p></div>
    </div>
  </>
}

export function QuestionDialog({question, review, onClose, onDecision}: {
  question: Question; review: boolean; onClose: () => void; onDecision: (question: Question, status: ReviewStatus, note: string) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [view, setView] = useState<'detail' | 'history'>('detail')

  async function decide(status: ReviewStatus) {
    if (pending) return
    if (['revision', 'rejected'].includes(status) && !note.trim()) {
      setError('Isi catatan review untuk menjelaskan keputusan.')
      return
    }
    setError('')
    setPending(true)
    try {
      await onDecision(question, status, note.trim())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Keputusan gagal disimpan.')
    } finally {
      setPending(false)
    }
  }

  return <Dialog title={review ? 'Periksa Soal' : 'Detail Soal'} wide onClose={onClose}>
    <div className="dialog-content question-detail">
      <div className="detail-meta"><span>{question.id} · Versi {question.version} · {question.course} · {question.level}</span><StatusPill status={question.status} /></div>
      <div className="segmented" aria-label="Tampilan detail soal">
        <button type="button" aria-pressed={view === 'detail'} onClick={() => setView('detail')}>Detail</button>
        <button type="button" aria-pressed={view === 'history'} onClick={() => setView('history')}><History size={15} /> Riwayat Soal</button>
      </div>
      {view === 'history' ? <QuestionHistoryPanel question={question} /> : <>
      <h3>{question.title}</h3><p>{question.stem}</p>
      <ul className="answer-list">{question.options.map((option, index) => <li key={index} className={index === question.answer ? 'answer-correct' : ''}>
        <span className="answer-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span>{index === question.answer && <Check size={18} aria-label="Kunci jawaban" />}
      </li>)}</ul>
      <div className="inset"><h4>Pembahasan</h4><p>{question.explanation || 'Pembahasan belum ditambahkan.'}</p></div>
      {question.reviewNote && <div className="inset"><h4>Catatan Review</h4><p>{question.reviewNote}</p></div>}
      {review && <label className="field">Catatan Review<textarea rows={3} maxLength={2000} value={note} onChange={(event) => {setNote(event.target.value); setError('')}} placeholder="Tulis alasan atau saran perbaikan" /></label>}
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    <footer className="dialog-footer">
      {review && view === 'detail' ? <>
        <button className="button danger" disabled={pending} onClick={() => void decide('rejected')}>Tolak</button>
        <button className="button secondary" disabled={pending} onClick={() => void decide('revision')}>Minta Revisi</button>
        <button className="button primary" disabled={pending} onClick={() => void decide('approved')}><Check size={17} /> {pending ? 'Menyimpan…' : 'Setujui'}</button>
      </> : <>
        {review && <button className="button secondary" onClick={() => setView('detail')}>Kembali ke Pemeriksaan</button>}
        {!review && question.status === 'review' && <button className="button secondary" onClick={() => {onClose(); window.location.hash = '/review-soal'}}>Buka Antrean Review</button>}
        {['draft', 'revision'].includes(question.status) && <a className="button primary" href={`#/buat-soal?id=${encodeURIComponent(question.id)}`} onClick={onClose}>Edit Soal</a>}
        <button className="button secondary" onClick={onClose}>Tutup</button>
      </>}
    </footer>
  </Dialog>
}

type EditorValues = QuestionFields
const initialEditor: EditorValues = {title: '', course: 'Basis Data', topic: '', level: 'Memahami', format: 'Pilihan Ganda', stem: '', options: defaultOptions, answer: 0, explanation: ''}
const editorValues = ({title, course, topic, level, format, stem, options, answer, explanation}: QuestionFields): QuestionFields => ({
  title, course, topic, level, format, stem, options, answer, explanation,
})

export function QuestionEditor({question, onSave, onGenerated, batchQuestions = []}: {
  question?: Question; onSave: (input: QuestionInput, id: string, revision?: number) => Promise<void>
  onGenerated: (drafts: Question[]) => void; batchQuestions?: Question[]
}) {
  const [draft, setDraft] = useState<EditorValues>(() => question ? editorValues(question) : initialEditor)
  const [id] = useState(() => question?.id ?? `BS-${crypto.randomUUID().toUpperCase()}`)
  const [error, setError] = useState('')
  const [changeNote, setChangeNote] = useState('')
  const [pending, setPending] = useState(false)
  const [mode, setMode] = useState<'manual' | 'ai'>('manual')
  const [loadingExample, setLoadingExample] = useState(false)
  const [generating, setGenerating] = useState(false)

  function change<K extends keyof EditorValues>(key: K, value: EditorValues[K]) {
    setDraft((previous) => ({...previous, [key]: value}))
    setError('')
  }

  async function loadExample() {
    setLoadingExample(true)
    setError('')
    try {
      setDraft(await getDraftExample())
      setMode('manual')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Contoh draf gagal dimuat.')
    } finally {
      setLoadingExample(false)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || generating || mode === 'ai') return
    const status = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'review' ? 'review' : 'draft'
    const options = draft.options.map((option) => option.trim())
    if (![draft.title, draft.topic, draft.stem].every((value) => value.trim()) || options.some((value) => !value)) {
      setError('Lengkapi judul, topik, pertanyaan, dan semua pilihan jawaban.')
      return
    }
    if (new Set(options.map((option) => option.toLocaleLowerCase('id'))).size !== options.length) {
      setError('Setiap pilihan jawaban harus berbeda.')
      return
    }
    if (status === 'review' && !draft.explanation.trim()) {
      setError('Tambahkan pembahasan sebelum mengajukan soal untuk review.')
      return
    }
    setError('')
    setPending(true)
    try {
      await onSave({...draft, options, status, changeNote}, id, question?.revision)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Soal gagal disimpan.')
    } finally {
      setPending(false)
    }
  }

  return <>
    <a className="back-link" href="#/bank-soal"><ArrowLeft size={16} /> Kembali ke Bank Soal</a>
    <PageHeading title={question ? 'Edit Soal' : 'Buat Soal'} description="Lengkapi pertanyaan, pilihan jawaban, dan metadata soal." />
    {batchQuestions.length > 0 && <section className="card generated-drafts" aria-label="Draf hasil AI">
      <div><h2>{batchQuestions.length} Draf Hasil AI</h2><p className="muted">Pilih soal untuk memeriksa isi, kunci, dan pembahasannya.</p></div>
      <nav aria-label="Pilih draf hasil AI">{batchQuestions.map((item, index) => <a key={item.id}
        className={`button ${item.id === question?.id ? 'primary' : 'secondary'}`}
        href={`#/buat-soal?id=${encodeURIComponent(item.id)}&batch=${encodeURIComponent(batchQuestions.map(({id}) => id).join(','))}`}
        aria-current={item.id === question?.id ? 'page' : undefined}>Soal {index + 1}</a>)}</nav>
    </section>}
    <div className="editor-layout">
      <form className="card editor-form" onSubmit={save} noValidate>
        <div className="segmented" aria-label="Cara membuat soal">
          <button type="button" disabled={pending || loadingExample || generating} aria-pressed={mode === 'manual'} onClick={() => {setMode('manual'); setError('')}}><BookOpen size={16} /> Editor Soal</button>
          <button type="button" disabled={pending || loadingExample || generating} aria-pressed={mode === 'ai'} onClick={() => {setMode('ai'); setError('')}}><Sparkles size={16} /> Bantuan AI</button>
        </div>
        {mode === 'ai' ? <div className="inset ai-message">
          <QuestionGenerator course={draft.course} topic={draft.topic} onGenerated={onGenerated} onPendingChange={setGenerating} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="button" className="button ghost" disabled={loadingExample || generating} onClick={() => void loadExample()}>{loadingExample ? 'Memuat contoh…' : 'Muat Satu Contoh Statis'}</button>
        </div> : <>
          <div className="form-grid">
            <label className="field">Judul Soal<input value={draft.title} maxLength={180} onChange={(event) => change('title', event.target.value)} placeholder="Misalnya, Normalisasi Basis Data" required /></label>
            <label className="field">Mata Kuliah<select value={draft.course} onChange={(event) => change('course', event.target.value as Course)}>{courses.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field">Topik<input value={draft.topic} maxLength={180} onChange={(event) => change('topic', event.target.value)} placeholder="Topik yang diuji" required /></label>
            <label className="field">Level Kognitif<select value={draft.level} onChange={(event) => change('level', event.target.value as Level)}>{levels.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field">Format Soal<select value={draft.format} onChange={(event) => {
              const format = event.target.value as Format
              setDraft((previous) => ({...previous, format, options: format === 'Pilihan Ganda' ? defaultOptions : ['Benar', 'Salah'], answer: 0}))
              setError('')
            }}>{formats.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <label className="field">Pertanyaan<textarea rows={4} maxLength={8000} value={draft.stem} onChange={(event) => change('stem', event.target.value)} placeholder="Tulis pertanyaan di sini" required /></label>
          <fieldset className="editor-options">
            <legend>Pilihan Jawaban</legend><p className="muted">Pilih satu opsi sebagai kunci jawaban.</p>
            {draft.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index)
              return <div className="editor-option" key={letter}>
                <label className="answer-radio"><input type="radio" name="key" checked={draft.answer === index} onChange={() => change('answer', index)} aria-label={`Jadikan opsi ${letter} sebagai kunci`} /><span>{letter}</span></label>
                <input aria-label={`Opsi ${letter}`} value={option} maxLength={2000} onChange={(event) => change('options', draft.options.map((item, i) => i === index ? event.target.value : item))} placeholder={`Tulis opsi ${letter}`} readOnly={draft.format === 'Benar/Salah'} required />
              </div>
            })}
          </fieldset>
          <label className="field">Pembahasan<textarea rows={3} maxLength={8000} value={draft.explanation} onChange={(event) => change('explanation', event.target.value)} placeholder="Jelaskan alasan jawaban yang tepat" /></label>
          {question?.source === 'ai' && <div className="inset"><p>Draf dibuat dengan bantuan AI. Periksa kebenaran isi dan kesesuaian level kognitif sebelum mengajukan review.</p>{question.suggestedMetadata && <p className="muted">Saran tag · {question.suggestedMetadata.tags.join(', ')}</p>}</div>}
          {question && <label className="field">Catatan Perubahan<textarea rows={2} maxLength={1000} value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Opsional, misalnya memperjelas redaksi pertanyaan" /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="submit" value="draft" className="button secondary" disabled={pending}>Simpan Draf</button><button type="submit" value="review" className="button primary" disabled={pending}><ClipboardCheck size={17} /> {pending ? 'Menyimpan…' : 'Ajukan Review'}</button></div>
        </>}
      </form>
      <aside className="card editor-preview">
        <div className="panel-heading"><h2><Eye size={17} /> Pratinjau</h2><Pill tone="purple">Draf</Pill></div>
        <p className="preview-question">{draft.stem || 'Pertanyaan akan tampil di sini.'}</p>
        <ul className="answer-list">{draft.options.map((option, index) => <li key={index}><span className="answer-letter">{String.fromCharCode(65 + index)}</span><span>{option || `Pilihan ${index + 1}`}</span></li>)}</ul>
      </aside>
    </div>
  </>
}
