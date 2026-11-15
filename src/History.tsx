import { Clock3, History as HistoryIcon, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAudit, getQuestionHistory } from './api'
import { auditLabels, formatDate, type AuditAction, type AuditEntry, type Question, type QuestionHistory } from './data'
import { Empty, PageHeading, Pill, StatusPill } from './ui'

const timestamp = new Intl.DateTimeFormat('id-ID', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta'})

export function QuestionHistoryPanel({question}: {question: Question}) {
  const [history, setHistory] = useState<QuestionHistory | null>(null)
  const [version, setVersion] = useState(question.version)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getQuestionHistory(question.id, controller.signal).then(setHistory).catch((reason: Error) => {
      if (!controller.signal.aborted) setError(reason.message)
    })
    return () => controller.abort()
  }, [question.id])

  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!history) return <p className="muted" role="status">Memuat riwayat soal…</p>

  const selected = history.versions.find((entry) => entry.version === version)
  return <div className="history-sections">
    <section aria-label="Riwayat versi">
      <div className="panel-heading"><h3>Riwayat Versi</h3><Pill tone="blue">Versi aktif {question.version}</Pill></div>
      <ul className="history-list">{history.versions.map((entry) => <li key={entry.version}>
        <button type="button" className="history-version" aria-pressed={entry.version === version} onClick={() => setVersion(entry.version)}>
          <span className="answer-letter">v{entry.version}</span>
          <span><strong>{entry.note}</strong><small>{entry.actor} · {timestamp.format(new Date(entry.created))} WIB</small></span>
        </button>
      </li>)}</ul>
      {selected && <div className="inset version-preview">
        <h4>Isi Versi {selected.version} · {selected.snapshot.title}</h4>
        <p>{selected.snapshot.course} · {selected.snapshot.topic} · {selected.snapshot.level} · {selected.snapshot.format}</p>
        <p>{selected.snapshot.stem}</p>
        <ol type="A">{selected.snapshot.options.map((option, index) => <li key={index}>{option}</li>)}</ol>
        <p><strong>Kunci {String.fromCharCode(65 + selected.snapshot.answer)}</strong></p>
        {selected.snapshot.explanation && <p>Pembahasan · {selected.snapshot.explanation}</p>}
      </div>}
    </section>
    <section aria-label="Keputusan review">
      <h3>Keputusan Review</h3>
      {history.reviews.length ? <ul className="history-list">
        {history.reviews.map(({status, note, actor, created, version}, index) => <li key={index} className="history-entry">
          <div><StatusPill status={status} /><small>{actor} · Versi {version} · {timestamp.format(new Date(created))} WIB</small>{note && <p>{note}</p>}</div>
        </li>)}
      </ul> : <p className="muted">Belum ada keputusan review yang tercatat.</p>}
    </section>
    <section aria-label="Riwayat paket ujian">
      <h3>Riwayat Paket Ujian</h3>
      {history.usage.length ? <ul className="history-list">
        {history.usage.map((item) => <li key={item.id} className="history-entry">
          <span className="answer-letter">v{item.version}</span><div><strong>{item.name}</strong><small>{item.id} · {formatDate(item.created)}</small></div>
        </li>)}
      </ul> : <p className="muted">Soal ini belum tercantum di paket ujian.</p>}
    </section>
  </div>
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState('')
  const [term, setTerm] = useState('')
  const [action, setAction] = useState<AuditAction | ''>('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getAudit(controller.signal).then(setEntries).catch((reason: Error) => {
      if (!controller.signal.aborted) setError(reason.message)
    })
    return () => controller.abort()
  }, [attempt])

  const needle = term.trim().toLocaleLowerCase('id')
  const results = (entries ?? []).filter((entry) => (!action || entry.action === action)
    && [entry.title, entry.entityId, entry.actor].join(' ').toLocaleLowerCase('id').includes(needle))
  const retry = () => {
    setEntries(null)
    setError('')
    setAttempt(attempt + 1)
  }

  return <>
    <PageHeading title="Audit Log" description="Telusuri perubahan soal, keputusan review, pembuatan paket, dan ekspor laporan." />
    <section className="card table-card">
      <div className="table-tools">
        <div className="panel-heading"><h2>Aktivitas Tercatat</h2><span className="muted"><Clock3 size={13} /> 100 terbaru · WIB</span></div>
        <div className="filter-row">
          <label className="search-field grow"><Search size={17} /><input type="search" aria-label="Cari aktivitas" placeholder="Cari objek, ID, atau aktor" value={term} onChange={(event) => setTerm(event.target.value)} /></label>
          <select aria-label="Jenis aktivitas" value={action} onChange={(event) => setAction(event.target.value as AuditAction | '')}>
            <option value="">Semua Aktivitas</option>
            {Object.entries(auditLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
      </div>
      {error ? <Empty title="Audit log belum bisa dimuat" description={error} action={<button type="button" className="button secondary" onClick={retry}>Coba Lagi</button>} />
        : entries === null ? <p className="loading-state" role="status">Memuat audit log…</p>
        : results.length ? <div className="table-scroll" tabIndex={0} aria-label="Tabel audit log">
          <table><thead><tr><th>Waktu</th><th>Aktivitas</th><th>Objek</th><th>Versi</th><th>Aktor</th></tr></thead>
            <tbody>{results.map((entry) => <tr key={entry.id}>
              <td>{timestamp.format(new Date(entry.created))}</td><td>{auditLabels[entry.action]}</td>
              <th scope="row"><strong>{entry.title}</strong><small className="long-id">{entry.entityId}</small></th>
              <td>{entry.version ?? '—'}</td><td>{entry.actor}</td>
            </tr>)}</tbody>
          </table>
        </div> : <Empty title="Aktivitas tidak ditemukan" description={entries.length ? 'Ubah filter untuk melihat aktivitas lain.' : 'Aktivitas akan muncul setelah perubahan pertama tersimpan.'} />}
    </section>
  </>
}
