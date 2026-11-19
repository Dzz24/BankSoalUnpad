import { Check, Download, FileSpreadsheet, Plus, Search, Upload } from 'lucide-react'
import Papa from 'papaparse'
import { useRef, useState, type FormEvent } from 'react'
import { exportQuestionReport } from './api'
import { CttPreview, type ResponseRow } from './CttPreview'
import { courses, downloadCsv, downloadFile, formatDate, statusInfo, type Course, type ExamImport, type ExamPackage, type PackageInput, type Profile, type Question } from './data'
import { Dialog, Empty, PageHeading, Pill } from './ui'

export function Packages({packages, questions, initialOpen, onAdd}: {packages: ExamPackage[]; questions: Question[]; initialOpen: boolean; onAdd: (item: PackageInput) => Promise<void>}) {
  const [open, setOpen] = useState(initialOpen)
  const [detail, setDetail] = useState<ExamPackage | null>(null)
  const [name, setName] = useState('')
  const [course, setCourse] = useState<Course>('Basis Data')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const packageId = useRef('')
  const eligible = questions.filter((question) => question.course === course && question.status === 'approved')
  const distinctTopics = new Set(detail?.items.map((item) => item.topic)).size
  const distinctLevels = new Set(detail?.items.map((item) => item.level)).size

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    if (!name.trim() || !selected.length) {
      setError('Isi nama paket dan pilih minimal satu soal.')
      return
    }
    packageId.current ||= `PK-${crypto.randomUUID().toUpperCase()}`
    setError('')
    setPending(true)
    try {
      await onAdd({id: packageId.current, name: name.trim(), course, questionIds: selected})
      packageId.current = ''
      setOpen(false)
      setName('')
      setSelected([])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Paket gagal disimpan.')
    } finally {
      setPending(false)
    }
  }

  return <>
    <PageHeading title="Paket Ujian" description="Susun paket ujian dari soal yang telah disetujui."
      action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={18} /> Buat Paket Ujian</button>} />
    <section className="card table-card">
      <div className="table-tools"><h2>Daftar Paket Ujian</h2></div>
      {packages.length ? <div className="table-scroll" tabIndex={0} aria-label="Tabel paket ujian"><table>
        <thead><tr><th>Nama Paket</th><th>Mata Kuliah</th><th>Jumlah Soal</th><th>Dibuat</th><th>Tindakan</th></tr></thead>
        <tbody>{packages.map((item) => <tr key={item.id}><th scope="row"><strong>{item.name}</strong><small className="long-id">{item.id}</small></th>
          <td>{item.course}</td><td>{item.items.length}</td><td>{formatDate(item.created)}</td>
          <td><button className="text-button" onClick={() => setDetail(item)}>Lihat Paket</button></td></tr>)}</tbody>
      </table></div> : <Empty title="Belum ada paket ujian" description="Buat paket pertama dari soal yang disetujui." />}
    </section>
    {open && <Dialog title="Buat Paket Ujian" onClose={() => setOpen(false)}>
      <form onSubmit={save} noValidate>
        <div className="dialog-content">
          <label className="field">Nama Paket<input value={name} maxLength={180} onChange={(event) => setName(event.target.value)} placeholder="Misalnya, UTS Basis Data" required /></label>
          <label className="field">Mata Kuliah<select value={course} onChange={(event) => {setCourse(event.target.value as Course); setSelected([]); setError('')}}>{courses.map((item) => <option key={item}>{item}</option>)}</select></label>
          <fieldset className="pick-list"><legend>Soal Disetujui</legend>
            {eligible.length ? eligible.map((question) => <label className="checkbox-row" key={question.id}>
              <input type="checkbox" checked={selected.includes(question.id)} onChange={(event) => {
                setSelected((previous) => event.target.checked ? [...previous, question.id] : previous.filter((id) => id !== question.id))
                setError('')
              }} /><span>{question.title}<small>{question.id} · Versi {question.version}</small></span>
            </label>) : <p className="muted">Belum ada soal disetujui untuk mata kuliah ini.</p>}
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <footer className="dialog-footer"><button type="button" className="button secondary" onClick={() => setOpen(false)} disabled={pending}>Batal</button><button className="button primary" type="submit" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan Paket'}</button></footer>
      </form>
    </Dialog>}
    {detail && <Dialog title={detail.name} onClose={() => setDetail(null)}>
      <div className="dialog-content"><p className="muted">{detail.course} · {formatDate(detail.created)}</p>
        <div className="inset"><h4>Cakupan Paket</h4><p>{detail.items.length} soal · {distinctTopics} topik · {distinctLevels} level kognitif</p></div>
        <ul className="answer-list">{detail.items.map((question, index) => <li key={question.questionId}>
          <span className="answer-letter">{index + 1}</span><span><strong>{question.title}</strong><small className="package-topic">{question.topic} · {question.level}</small></span><Pill tone="blue">Versi {question.version}</Pill>
        </li>)}</ul>
      </div>
      <footer className="dialog-footer"><button className="button secondary" onClick={() => setDetail(null)}>Tutup</button></footer>
    </Dialog>}
  </>
}

const csvColumns = ['id_peserta', 'id_soal', 'versi_soal', 'respons'] as const

export function Results({imports, questions, initialOpen, onAdd}: {imports: ExamImport[]; questions: Question[]; initialOpen: boolean; onAdd: (item: ExamImport) => void}) {
  const [open, setOpen] = useState(initialOpen)
  const [preview, setPreview] = useState<{id: number; name: string; total: number; rows: ResponseRow[]; allRows: ResponseRow[]} | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const readId = useRef(0)

  function close() {
    readId.current += 1
    setOpen(false)
    setPreview(null)
    setError('')
    setLoading(false)
  }

  async function read(file?: File) {
    const id = ++readId.current
    setPreview(null)
    setError('')
    setLoading(false)
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 5 * 1024 * 1024) {
      setError('Pilih file CSV dengan ukuran maksimal 5 MB.')
      return
    }
    setLoading(true)
    try {
      const source = await file.text()
      if (id !== readId.current) return
      const parsed = Papa.parse<ResponseRow>(source, {header: true, skipEmptyLines: 'greedy', transformHeader: (value) => value.trim().toLowerCase(), transform: (value) => value.trim()})
      if (csvColumns.some((name) => !parsed.meta.fields?.includes(name))) throw new Error('Kolom CSV belum lengkap. Gunakan template di bawah.')
      if (parsed.errors.length || !parsed.data.length) throw new Error('CSV kosong atau format barisnya tidak konsisten.')
      const keys = new Set<string>()
      for (const [index, row] of parsed.data.entries()) {
        if (!row.id_peserta || !row.id_soal || !row.versi_soal) throw new Error(`Lengkapi ID peserta, ID soal, dan versi soal pada baris ${index + 2}.`)
        const key = JSON.stringify([row.id_peserta, row.id_soal, row.versi_soal])
        if (keys.has(key)) throw new Error(`Ditemukan respons duplikat pada baris ${index + 2}.`)
        keys.add(key)
      }
      setPreview({id, name: file.name, total: parsed.data.length, rows: parsed.data.slice(0, 4), allRows: parsed.data})
    } catch (error) {
      if (id === readId.current) setError(error instanceof Error ? error.message : 'File gagal dibaca.')
    } finally {
      if (id === readId.current) setLoading(false)
    }
  }

  return <>
    <PageHeading title="Hasil Ujian" description="Pratinjau file respons dan pantau riwayat impor di perangkat ini."
      action={<button className="button primary" onClick={() => setOpen(true)}><Upload size={17} /> Impor Hasil Ujian</button>} />
    <section className="card table-card">
      <div className="table-tools"><h2>Riwayat Impor</h2></div>
      {imports.length ? <div className="table-scroll" tabIndex={0} aria-label="Tabel riwayat impor"><table>
        <thead><tr><th>Nama File</th><th>Jumlah Respons</th><th>Tanggal</th><th>Status</th></tr></thead>
        <tbody>{imports.map((item) => <tr key={item.id}><th scope="row"><strong>{item.name}</strong><small>{item.id}</small></th>
          <td>{item.rows}</td><td>{formatDate(item.created)}</td><td><Pill tone="green">Tercatat</Pill></td></tr>)}</tbody>
      </table></div> : <Empty title="Belum ada riwayat impor" description="Pilih file CSV untuk memulai pratinjau." />}
    </section>
    {open && <Dialog title="Impor Hasil Ujian" wide onClose={close}>
      <div className="dialog-content">
        <label className="file-drop"><span className="icon-tile tone-blue"><FileSpreadsheet size={24} /></span><strong>Pilih file respons CSV</strong><small>Gunakan ID peserta samaran. Maksimal 5 MB.</small><input type="file" accept=".csv,text/csv" onChange={(event) => void read(event.target.files?.[0])} /></label>
        <button className="text-button" onClick={() => downloadCsv('template-respons-ujian.csv', [[...csvColumns], ['P001', 'BS-240', '1', 'A']])}><Download size={16} /> Unduh Template CSV</button>
        {loading && <p className="muted" role="status">Membaca file…</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {preview && <><p><strong>{preview.name}</strong> · {preview.total} baris respons</p>
          <div className="table-scroll preview-table" tabIndex={0} aria-label="Tabel pratinjau CSV"><table>
            <thead><tr><th>Peserta</th><th>Soal</th><th>Versi</th><th>Respons</th></tr></thead>
            <tbody>{preview.rows.map((row, index) => <tr key={index}><td>{row.id_peserta}</td><td>{row.id_soal}</td><td>{row.versi_soal}</td><td>{row.respons || 'Kosong'}</td></tr>)}</tbody>
          </table></div>
          <p className="muted">Riwayat impor hanya mencatat nama file dan jumlah baris. Pratinjau CTT di bawah dihitung di browser dan belum disimpan.</p>
          <CttPreview key={preview.id} rows={preview.allRows} questions={questions} />
        </>}
      </div>
      <footer className="dialog-footer">
        <button className="button secondary" onClick={close}>Batal</button>
        <button className="button primary" disabled={!preview} onClick={() => {
          if (!preview) return
          onAdd({id: `IMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, name: preview.name, rows: preview.total, created: new Date().toISOString()})
          close()
        }}>Simpan Riwayat</button>
      </footer>
    </Dialog>}
  </>
}

export function Reports({questions}: {questions: Question[]}) {
  const [course, setCourse] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const rows = questions.filter((question) => !course || question.course === course)
  const summary = Object.entries(statusInfo).map(([status, info]) => ({...info, count: rows.filter((question) => question.status === status).length}))

  async function download() {
    setPending(true)
    setError('')
    try {
      downloadFile('laporan-bank-soal.csv', await exportQuestionReport(course))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Laporan gagal dibuat.')
    } finally {
      setPending(false)
    }
  }

  return <>
    <PageHeading title="Laporan" description="Lihat rekap status soal dan unduh daftar soal."
      action={<button className="button primary" disabled={!rows.length || pending} onClick={() => void download()}><Download size={17} /> {pending ? 'Menyiapkan…' : 'Unduh Laporan CSV'}</button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="card table-card">
      <div className="table-tools"><div className="panel-heading"><h2>Rekap Status Soal</h2><span className="muted">{rows.length} soal</span></div>
        <div className="filter-row"><Search size={17} /><select aria-label="Mata kuliah laporan" value={course} onChange={(event) => setCourse(event.target.value)}><option value="">Semua Mata Kuliah</option>{courses.map((item) => <option key={item}>{item}</option>)}</select></div>
      </div>
      <div className="table-scroll" tabIndex={0} aria-label="Tabel rekap status"><table>
        <thead><tr><th>Status</th><th>Jumlah Soal</th></tr></thead>
        <tbody>{summary.map(({label, tone, count}) => <tr key={label}><th scope="row"><Pill tone={tone}>{label}</Pill></th><td>{count}</td></tr>)}</tbody>
      </table></div>
    </section>
  </>
}

export function Settings({profile, onSave}: {profile: Profile; onSave: (profile: Profile) => void}) {
  const [name, setName] = useState(profile.name)
  const [faculty, setFaculty] = useState(profile.faculty)
  const [error, setError] = useState('')
  const [legacy] = useState(() => {
    try {
      const questions = localStorage.getItem('bank-soal-unpad:v1:questions')
      const packages = localStorage.getItem('bank-soal-unpad:v1:packages')
      return questions || packages ? {questions: JSON.parse(questions ?? '[]'), packages: JSON.parse(packages ?? '[]')} : null
    } catch {
      return null
    }
  })

  return <>
    <PageHeading title="Pengaturan Sistem" description="Atur profil tampilan di perangkat ini. Audit log mencatat nama pengguna akun." />
    <form className="card editor-form settings-form" onSubmit={(event) => {
      event.preventDefault()
      if (!name.trim() || !faculty.trim()) {
        setError('Nama tampilan dan fakultas wajib diisi.')
        return
      }
      setError('')
      onSave({name: name.trim(), faculty: faculty.trim()})
    }}>
      <h2>Profil Akun</h2>
      <label className="field">Nama Tampilan<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} /></label>
      <label className="field">Fakultas<input value={faculty} onChange={(event) => setFaculty(event.target.value)} required maxLength={45} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="submit" className="button primary"><Check size={17} /> Simpan Pengaturan</button></div>
    </form>
    {legacy && <section className="card guidance legacy-export">
      <div><h2>Data Prototipe Sebelumnya</h2><p>Unduh soal dan paket yang masih tersimpan di browser ini.</p></div>
      <button type="button" className="button secondary" onClick={() => downloadFile('cadangan-bank-soal-lokal.json', new Blob([JSON.stringify(legacy, null, 2)], {type: 'application/json'}))}><Download size={16} /> Unduh Cadangan</button>
    </section>}
  </>
}
