import { Check, Download, FileSpreadsheet, Plus, Search, Upload } from 'lucide-react'
import Papa from 'papaparse'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createImport, exportQuestionReport, listImports, runAnalysis, type ImportError } from './api'
import { academicYears, defaultSemester, formatPeriod, semesters } from '../shared/academic-period.js'
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

type ResultsProps = {packages: ExamPackage[]; questions: Question[]; initialOpen: boolean; onChanged: () => void; onToast: (message: string) => void}

export function Results({packages, questions, initialOpen, onChanged, onToast}: ResultsProps) {
  const [imports, setImports] = useState<ExamImport[] | null>(null)
  const [listError, setListError] = useState('')
  const [open, setOpen] = useState(initialOpen)
  const [packageId, setPackageId] = useState(packages[0]?.id ?? '')
  const [semester, setSemester] = useState<string>(() => defaultSemester())
  const [year, setYear] = useState(() => academicYears()[0])
  const period = formatPeriod(semester, year)
  const [preview, setPreview] = useState<{id: number; name: string; total: number; rows: ResponseRow[]; allRows: ResponseRow[]} | null>(null)
  const [error, setError] = useState('')
  const [rowErrors, setRowErrors] = useState<{errors: ImportError[]; count: number} | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyze, setAnalyze] = useState<ExamImport | null>(null)
  const [blank, setBlank] = useState<'incorrect' | 'exclude'>('incorrect')
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const readId = useRef(0)
  const importId = useRef('')
  // Pilihan paket yang tampil di layar selalu yang dipakai, termasuk saat state belum terisi.
  const activePackageId = packages.some((item) => item.id === packageId) ? packageId : packages[0]?.id ?? ''
  const selectedPackage = packages.find((item) => item.id === activePackageId)

  function reload() {
    listImports().then((items) => {setImports(items); setListError('')}).catch((reason: Error) => setListError(reason.message))
  }
  useEffect(reload, [])

  function close() {
    readId.current += 1
    importId.current = ''
    setOpen(false)
    setPreview(null)
    setError('')
    setRowErrors(null)
    setLoading(false)
  }

  async function read(file?: File) {
    const id = ++readId.current
    importId.current = ''
    setPreview(null)
    setError('')
    setRowErrors(null)
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
      setPreview({id, name: file.name, total: parsed.data.length, rows: parsed.data.slice(0, 4), allRows: parsed.data})
    } catch (error) {
      if (id === readId.current) setError(error instanceof Error ? error.message : 'File gagal dibaca.')
    } finally {
      if (id === readId.current) setLoading(false)
    }
  }

  async function save() {
    if (!preview || saving) return
    if (!activePackageId) {
      setError('Belum ada paket ujian. Buat paket di menu Paket Ujian terlebih dahulu.')
      return
    }
    importId.current ||= `IMP-${crypto.randomUUID().toUpperCase()}`
    setSaving(true)
    setError('')
    setRowErrors(null)
    try {
      await createImport({id: importId.current, packageId: activePackageId, period, fileName: preview.name, rows: preview.allRows.map((row) => ({...row}))})
      close()
      reload()
      onToast('Hasil ujian tersimpan. Jalankan analisis dari riwayat impor.')
    } catch (reason) {
      const failure = reason as Error & {errors?: ImportError[]; errorCount?: number}
      importId.current = ''
      setError(failure.message)
      if (failure.errors?.length) setRowErrors({errors: failure.errors, count: failure.errorCount ?? failure.errors.length})
    } finally {
      setSaving(false)
    }
  }

  async function startAnalysis() {
    if (!analyze || running) return
    setRunning(true)
    setRunError('')
    try {
      await runAnalysis(analyze.id, blank)
      setAnalyze(null)
      reload()
      onChanged()
      onToast('Analisis CTT selesai dan hasilnya disimpan.')
    } catch (reason) {
      setRunError(reason instanceof Error ? reason.message : 'Analisis gagal dijalankan.')
    } finally {
      setRunning(false)
    }
  }

  return <>
    <PageHeading title="Hasil Ujian" description="Impor respons per paket ujian, validasi, simpan, lalu jalankan analisis CTT."
      action={<button className="button primary" onClick={() => setOpen(true)} disabled={!packages.length}><Upload size={17} /> Impor Hasil Ujian</button>} />
    <section className="card table-card">
      <div className="table-tools"><h2>Riwayat Impor</h2></div>
      {listError ? <Empty title="Riwayat impor belum bisa dimuat" description={listError} action={<button className="button secondary" onClick={reload}>Coba Lagi</button>} />
        : !imports ? <p className="loading-state" role="status">Memuat riwayat impor…</p>
        : imports.length ? <div className="table-scroll" tabIndex={0} aria-label="Tabel riwayat impor"><table>
          <thead><tr><th>Paket · Periode</th><th>File</th><th>Peserta</th><th>Status</th><th>Tindakan</th></tr></thead>
          <tbody>{imports.map((item) => <tr key={item.id}>
            <th scope="row"><strong>{item.packageName}</strong><small>{item.period} · {formatDate(item.created)}</small></th>
            <td>{item.fileName}<small className="cell-note">{item.rowCount} baris</small></td>
            <td>{item.participantCount}</td>
            <td>{item.runId ? <Pill tone="green">Dianalisis</Pill> : <Pill tone="amber">Tersimpan</Pill>}
              {item.summary && <small className="cell-note">Tinggi {item.summary.followUp.high} · Sedang {item.summary.followUp.medium} · Rendah {item.summary.followUp.low}</small>}</td>
            <td>{item.runId
              ? <a className="text-button" href={`#/analisis-kualitas?impor=${encodeURIComponent(item.id)}`}>Lihat Hasil</a>
              : <button className="button secondary compact" onClick={() => {setRunError(''); setBlank('incorrect'); setAnalyze(item)}}>Jalankan Analisis</button>}</td>
          </tr>)}</tbody>
        </table></div> : <Empty title="Belum ada hasil ujian" description="Impor file respons untuk paket ujian yang sudah dilaksanakan." />}
    </section>
    {open && <Dialog title="Impor Hasil Ujian" wide onClose={close}>
      <div className="dialog-content">
        <div className="form-grid">
          <label className="field">Paket Ujian<select value={activePackageId} onChange={(event) => {setPackageId(event.target.value); setRowErrors(null); importId.current = ''}}>
            {packages.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.items.length} soal</option>)}</select></label>
          <fieldset className="field period-field"><legend>Periode</legend><div className="period-fields">
            <select aria-label="Semester" value={semester} onChange={(event) => {setSemester(event.target.value); importId.current = ''}}>{semesters.map((item) => <option key={item}>{item}</option>)}</select>
            <select aria-label="Tahun akademik" value={year} onChange={(event) => {setYear(event.target.value); importId.current = ''}}>{academicYears().map((item) => <option key={item}>{item}</option>)}</select>
          </div></fieldset>
        </div>
        <label className="file-drop"><span className="icon-tile tone-blue"><FileSpreadsheet size={24} /></span><strong>Pilih file respons CSV</strong><small>Gunakan ID peserta samaran. Satu baris per peserta per soal. Maksimal 5 MB.</small><input type="file" accept=".csv,text/csv" onChange={(event) => void read(event.target.files?.[0])} /></label>
        <button className="text-button" onClick={() => downloadCsv('template-respons-ujian.csv', [[...csvColumns], ...(selectedPackage?.items.slice(0, 3).map((item) => ['P001', item.questionId, String(item.version), 'A']) ?? [['P001', 'BS-240', '1', 'A']])])}><Download size={16} /> Unduh Template CSV untuk Paket Ini</button>
        {loading && <p className="muted" role="status">Membaca file…</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {rowErrors && <div className="inset import-errors" role="alert"><strong>{rowErrors.count} masalah di file</strong>
          <ul>{rowErrors.errors.map((item, index) => <li key={index}>{item.row ? `Baris ${item.row}: ` : ''}{item.message}</li>)}</ul>
          {rowErrors.count > rowErrors.errors.length && <p className="muted">Menampilkan {rowErrors.errors.length} masalah pertama.</p>}</div>}
        {preview && <><p><strong>{preview.name}</strong> · {preview.total} baris respons</p>
          <div className="table-scroll preview-table" tabIndex={0} aria-label="Tabel pratinjau CSV"><table>
            <thead><tr><th>Peserta</th><th>Soal</th><th>Versi</th><th>Respons</th></tr></thead>
            <tbody>{preview.rows.map((row, index) => <tr key={index}><td>{row.id_peserta}</td><td>{row.id_soal}</td><td>{row.versi_soal}</td><td>{row.respons || 'Kosong'}</td></tr>)}</tbody>
          </table></div>
          <p className="muted">Server memeriksa setiap baris terhadap paket yang dipilih: ID dan versi soal, opsi jawaban, jawaban ganda, dan kelengkapan per peserta. File yang bermasalah tidak disimpan.</p>
          <CttPreview key={preview.id} rows={preview.allRows} questions={questions} />
        </>}
      </div>
      <footer className="dialog-footer">
        <button className="button secondary" onClick={close} disabled={saving}>Batal</button>
        <button className="button primary" disabled={!preview || saving} onClick={() => void save()}>{saving ? 'Memvalidasi…' : 'Validasi & Simpan'}</button>
      </footer>
    </Dialog>}
    {analyze && <Dialog title="Jalankan Analisis CTT" onClose={() => setAnalyze(null)}>
      <div className="dialog-content">
        <p><strong>{analyze.packageName}</strong> · {analyze.period} · {analyze.participantCount} peserta</p>
        <label className="field">Respons kosong<select value={blank} onChange={(event) => setBlank(event.target.value as 'incorrect' | 'exclude')}>
          <option value="incorrect">Dihitung salah (default)</option><option value="exclude">Tidak dihitung</option></select></label>
        <div className="inset"><p>Hasil disimpan per versi soal dan tidak bisa ditimpa. Batas penilaian memakai default sementara yang menunggu persetujuan pakar assessment.</p></div>
        {runError && <p className="form-error" role="alert">{runError}</p>}
      </div>
      <footer className="dialog-footer"><button className="button secondary" onClick={() => setAnalyze(null)} disabled={running}>Batal</button>
        <button className="button primary" onClick={() => void startAnalysis()} disabled={running}>{running ? 'Menghitung…' : 'Jalankan Analisis'}</button></footer>
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
