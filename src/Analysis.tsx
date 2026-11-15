import { BarChart3, BookOpen, Download, Filter, Upload } from 'lucide-react'
import { useState } from 'react'
import { courses, downloadCsv, formatDecimal, qualityRows, type Tone } from './data'
import { Bar, Dialog, Empty, PageHeading, Pill } from './ui'

const bands: Array<{label: string; tone: Tone; match: (value: number) => boolean}> = [
  {label: 'Mudah', tone: 'green', match: (value) => value >= 0.7},
  {label: 'Sedang', tone: 'blue', match: (value) => value >= 0.4 && value < 0.7},
  {label: 'Sulit', tone: 'amber', match: (value) => value < 0.4},
]

type AnalysisDialog = {title: string; mode: 'ctt' | 'rasch'; ids?: string[]}

export function Analysis() {
  const [course, setCourse] = useState('')
  const [period, setPeriod] = useState('2026')
  const [dialog, setDialog] = useState<AnalysisDialog | null>(null)
  const rows = period === '2026' ? qualityRows.filter((row) => !course || row.course === course) : []
  const average = (field: 'difficulty' | 'discrimination') => formatDecimal(rows.reduce((sum, row) => sum + row[field], 0) / rows.length)
  const effectivePercent = rows.length ? Math.round(100 * rows.reduce((sum, row) => sum + row.effective, 0) / rows.reduce((sum, row) => sum + row.options, 0)) : 0
  const metrics = [
    {title: 'Rata-rata Kesulitan', value: rows.length ? average('difficulty') : '—', description: 'Proporsi jawaban benar'},
    {title: 'Daya Pembeda', value: rows.length ? average('discrimination') : '—', description: 'Rata-rata indeks butir'},
    {title: 'Pengecoh Efektif', value: rows.length ? `${effectivePercent}%` : '—', description: 'Proporsi opsi pengecoh'},
    {title: 'Reliabilitas Tes', value: rows.length && !course ? '0,81' : '—', description: 'Nilai contoh tingkat tes'},
  ]
  const flags = [
    {label: 'Pengecoh perlu ditinjau', tone: 'amber' as const, ids: rows.filter((row) => row.effective < row.options).map((row) => row.id)},
    {label: 'Daya pembeda rendah', tone: 'red' as const, ids: rows.filter((row) => row.discrimination < 0.25).map((row) => row.id)},
  ]
  const detailRows = dialog?.ids ? rows.filter((row) => dialog.ids?.includes(row.id)) : rows

  return <>
    <PageHeading title="Analisis Kualitas Soal" description="Tinjau indeks kualitas dan penanda soal dari contoh hasil ujian."
      action={<a className="button primary" href="#/hasil-ujian?impor=1"><Upload size={17} /> Impor Hasil Ujian</a>} />
    <div className="filter-row analysis-filters">
      <span className="filter-caption"><Filter size={16} /> Filter</span>
      <select aria-label="Mata kuliah analisis" value={course} onChange={(event) => setCourse(event.target.value)}><option value="">Semua Mata Kuliah</option>{courses.map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="Periode analisis" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="2026">Periode 2026</option><option value="2025">Periode 2025</option></select>
    </div>
    <section className="metric-grid" aria-label="Indikator kualitas">
      {metrics.map(({title, value, description}) => <div className="card metric analysis-metric" key={title}>
        <span className="metric-label">{title}</span><strong className="metric-value">{value}</strong><small>{description}</small>
      </div>)}
    </section>
    <div className="dashboard-grid">
      <section className="card dashboard-panel">
        <div className="panel-heading"><h2>Ringkasan Indeks Soal</h2></div>
        {rows.length ? <><p className="panel-description">Distribusi tingkat kesulitan</p><ul className="distribution-list">
          {bands.map(({label, tone, match}) => {
            const percent = Math.round(100 * rows.filter((row) => match(row.difficulty)).length / rows.length)
            return <li key={label}><div className="bar-label"><span>{label}</span><strong>{percent}%</strong></div><Bar value={percent} tone={tone} /></li>
          })}
        </ul></> : <Empty title="Data contoh tidak tersedia" description="Pilih mata kuliah atau periode lain." />}
      </section>
      <section className="card dashboard-panel">
        <div className="panel-heading"><h2>Perlu Ditinjau</h2></div>
        <ul className="flag-list">{flags.map(({label, tone, ids}) => <li key={label}>
          <strong>{label}</strong><Pill tone={tone}>{ids.length} soal</Pill>
          <button className="text-button" disabled={!ids.length} onClick={() => setDialog({title: label, mode: 'ctt', ids})}>Lihat daftar soal</button>
        </li>)}</ul>
      </section>
    </div>
    <section className="quick-section">
      <div className="panel-heading"><h2>Metode Analisis</h2></div>
      <div className="quick-grid two-columns">
        <button className="quick-card card" onClick={() => setDialog({title: 'Hasil Analisis CTT', mode: 'ctt'})}><span className="icon-tile tone-blue"><BarChart3 size={21} /></span><span><strong>CTT · Analisis Awal</strong><small>Kesulitan, daya pembeda, dan pengecoh.</small></span></button>
        <button className="quick-card card" onClick={() => setDialog({title: 'Hasil Kalibrasi Rasch / IRT', mode: 'rasch'})}><span className="icon-tile tone-purple"><BookOpen size={21} /></span><span><strong>Rasch / IRT · Analisis Lanjutan</strong><small>Parameter kesulitan dan kecocokan model.</small></span></button>
      </div>
    </section>
    {dialog && <Dialog title={dialog.title} onClose={() => setDialog(null)} wide>
      {dialog.mode === 'rasch' ? <Empty title="Belum ada hasil kalibrasi" description="Hasil dapat ditampilkan saat dataset dan hasil pemeriksaan model tersedia." />
        : detailRows.length ? <div className="table-scroll" tabIndex={0} aria-label="Tabel contoh CTT">
          <table><thead><tr><th>Soal</th><th>Proporsi Benar</th><th>Daya Pembeda</th><th>Pengecoh Efektif</th></tr></thead>
            <tbody>{detailRows.map((row) => <tr key={row.id}><th scope="row"><strong>{row.title}</strong><small>{row.id}</small></th>
              <td>{formatDecimal(row.difficulty)}</td><td>{formatDecimal(row.discrimination)}</td><td>{row.effective} / {row.options}</td></tr>)}</tbody></table>
        </div> : <Empty title="Hasil CTT tidak tersedia" description="Ubah filter untuk melihat data contoh lainnya." />}
      <footer className="dialog-footer">
        {dialog.mode === 'ctt' && detailRows.length > 0 && <button className="button secondary" onClick={() => downloadCsv('contoh-analisis-ctt.csv', [['id_soal', 'soal', 'proporsi_benar', 'daya_pembeda'], ...detailRows.map((row) => [row.id, row.title, row.difficulty, row.discrimination])])}><Download size={16} /> Unduh CSV</button>}
        <button className="button secondary" onClick={() => setDialog(null)}>Tutup</button>
      </footer>
    </Dialog>}
  </>
}
