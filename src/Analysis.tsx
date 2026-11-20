import { Archive, BookOpen, Check, Download, PencilLine, ShieldCheck, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { decideFollowUp, getAnalysis, type AnalysisOverview, type AnalysisResultRow } from './api'
import { choiceLabel, priorityInfo, sufficiencyLabel } from './CttPreview'
import { downloadCsv, formatDate, formatDecimal, type FollowUpDecision, type Question } from './data'
import { Dialog, Empty, PageHeading, Pill, StatusPill } from './ui'

const decisionInfo: Record<FollowUpDecision, {label: string; description: string; tone: 'green' | 'amber' | 'gray'}> = {
  keep: {label: 'Pertahankan', description: 'Status tetap Disetujui', tone: 'green'},
  revise: {label: 'Revisi', description: 'Status jadi Perlu Revisi, lalu diedit dan direview ulang', tone: 'amber'},
  retire: {label: 'Pensiunkan', description: 'Tidak bisa dipilih untuk paket baru', tone: 'gray'},
}
const priorityOrder = {high: 0, medium: 1, low: 2}
const number = (value: number | null | undefined) => value === null || value === undefined ? '—' : formatDecimal(value)

/** Keadaan tindak lanjut satu hasil. Hanya "pending" yang menunggu keputusan dosen. */
type FollowState = 'pending' | 'decided' | 'none' | 'insufficient' | 'retired' | 'in-process' | 'outdated'
function followState(row: AnalysisResultRow): FollowState {
  if (row.decision) return 'decided'
  if (!row.analyzed) return 'insufficient'
  if (!row.priority) return 'none'
  if (row.currentStatus === 'retired') return 'retired'
  if (row.currentStatus !== 'approved') return 'in-process'
  if (row.currentVersion !== row.version) return 'outdated'
  return 'pending'
}
const processLabel: Partial<Record<Question['status'], string>> = {revision: 'Sedang direvisi', review: 'Sedang direview', draft: 'Draf', rejected: 'Ditolak'}
const closedInfo = (row: AnalysisResultRow) => ({
  retired: 'Soal ini sudah dipensiunkan, jadi tidak perlu keputusan baru. Hasil ini disimpan sebagai riwayat penggunaan soal.',
  'in-process': `Soal sedang dalam proses ${row.currentStatus === 'review' ? 'review' : 'revisi'}. Hasil ini disimpan sebagai riwayat dan bukti tambahan; status soal hanya berubah lewat alur review.`,
  outdated: `Hasil ini untuk versi ${row.version}, sedangkan soal sekarang versi ${row.currentVersion}. Keputusan diambil dari hasil analisis versi terbaru.`,
} as Record<string, string>)[followState(row)]

type Props = {params: URLSearchParams; questions: Question[]; onApplied: (question: Question) => void; onToast: (message: string) => void}

export function Analysis({params, questions, onApplied, onToast}: Props) {
  const [data, setData] = useState<AnalysisOverview | null>(null)
  const [error, setError] = useState('')
  const [importId, setImportId] = useState(params.get('impor') ?? '')
  const [view, setView] = useState<'all' | 'pending'>('all')
  const [detail, setDetail] = useState<AnalysisResultRow | null>(null)

  function reload() {
    getAnalysis().then((value) => {setData(value); setError('')}).catch((reason: Error) => setError(reason.message))
  }
  useEffect(reload, [])

  const analyzed = data?.imports.filter((item) => item.runId) ?? []
  const current = analyzed.find((item) => item.id === importId) ?? analyzed[0]
  const rows = (data?.results ?? []).filter((row) => row.importId === current?.id)
  const pending = rows.filter((row) => followState(row) === 'pending')
    .sort((a, b) => priorityOrder[a.priority!] - priorityOrder[b.priority!])
  const pendingAll = (data?.results ?? []).filter((row) => followState(row) === 'pending')
  const shown = view === 'pending' ? pending : rows
  const summary = current?.summary

  if (error) return <><PageHeading title="Analisis Kualitas Soal" description="Hasil analisis CTT per paket ujian dan tindak lanjut per butir soal." />
    <section className="card"><Empty title="Hasil analisis belum bisa dimuat" description={error} action={<button className="button secondary" onClick={reload}>Coba Lagi</button>} /></section></>
  if (!data) return <p className="loading-state" role="status">Memuat hasil analisis…</p>

  return <>
    <PageHeading title="Analisis Kualitas Soal" description="Hasil analisis CTT per paket ujian dan tindak lanjut per butir soal."
      action={<a className="button primary" href="#/hasil-ujian?impor=1"><Upload size={17} /> Impor Hasil Ujian</a>} />
    {!current ? <section className="card"><Empty title="Belum ada hasil analisis" description="Impor hasil ujian per paket, lalu jalankan analisis CTT dari halaman Hasil Ujian."
      action={<a className="button secondary" href="#/hasil-ujian">Buka Hasil Ujian</a>} /></section> : <>
      <div className="filter-row analysis-filters">
        <select aria-label="Paket ujian dan periode" value={current.id} onChange={(event) => {setImportId(event.target.value); setView('all')}}>
          {analyzed.map((item) => <option key={item.id} value={item.id}>{item.packageName} · {item.period} · {formatDate(item.created)}</option>)}
        </select>
        <span className="muted">{current.participantCount} peserta · {rows.length} soal · dianalisis {current.analyzedAt ? formatDate(current.analyzedAt) : ''}</span>
      </div>
      <section className="metric-grid" aria-label="Indikator kualitas">
        {[
          {title: 'Rata-rata Kesukaran', value: number(summary?.averageDifficulty), description: 'Proporsi jawaban benar'},
          {title: 'Rata-rata Daya Pembeda', value: number(summary?.averageDiscrimination), description: 'Indeks D kelompok 27%'},
          {title: 'Pengecoh Efektif', value: summary?.effectiveDistractorShare === null || summary?.effectiveDistractorShare === undefined ? '—' : `${Math.round(summary.effectiveDistractorShare * 100)}%`, description: 'Soal pilihan ganda'},
          {title: 'Reliabilitas KR-20', value: number(summary?.reliability.kr20), description: summary?.reliability.note ?? 'Untuk paket ini'},
        ].map(({title, value, description}) => <div className="card metric analysis-metric" key={title}>
          <span className="metric-label">{title}</span><strong className="metric-value">{value}</strong><small>{description}</small>
        </div>)}
      </section>
      <section className="card quality-overview" aria-label="Peta kualitas butir dan status tindak lanjut">
        <div className="quality-map-panel">
          <div className="panel-heading"><h2>Peta Kualitas Butir</h2><span className="muted">Kesukaran (p) terhadap daya pembeda (D) · klik titik untuk meninjau</span></div>
          <QualityMap rows={rows} onOpen={setDetail} />
        </div>
        <FollowUpStatus rows={rows} pendingAll={pendingAll.length} onShowPending={() => setView('pending')} />
      </section>
      <section className="card table-card">
        <div className="table-tools">
          <div className="panel-heading"><h2>Hasil per Soal</h2></div>
          <div className="filter-row">
            <div className="segmented" aria-label="Tampilan hasil">
              <button aria-pressed={view === 'all'} onClick={() => setView('all')}>Semua soal</button>
              <button aria-pressed={view === 'pending'} onClick={() => setView('pending')}>Menunggu keputusan ({pending.length})</button>
            </div>
            <button className="button secondary compact" onClick={() => downloadCsv(`analisis-ctt-${current.period}.csv`, [
              ['id_soal', 'versi', 'judul', 'n', 'proporsi_benar', 'kategori', 'daya_pembeda_d', 'point_biserial', 'pengecoh', 'status_data', 'prioritas', 'keputusan', 'alasan'],
              ...rows.map((row) => [row.questionId, row.version, row.title, row.result.n, number(row.result.difficulty), row.result.difficultyBand ?? '', number(row.result.discrimination), number(row.result.pointBiserial),
                row.result.effectiveDistractors === null ? '' : `${row.result.effectiveDistractors}/${row.result.distractorCount}`, sufficiencyLabel[row.result.sufficiency],
                row.priority ? priorityInfo[row.priority].label : '', row.decision ? decisionInfo[row.decision.decision].label : '', row.decision?.reason ?? '']),
            ])}><Download size={15} /> Unduh CSV</button>
          </div>
        </div>
        {shown.length ? <div className="table-scroll" tabIndex={0} aria-label="Tabel hasil analisis per soal"><table>
          <thead><tr><th>Soal</th><th>Tindak Lanjut</th><th>Kesukaran</th><th>Daya Pembeda</th><th>Pengecoh</th><th>Data</th><th className="action-cell">Tindakan</th></tr></thead>
          <tbody>{shown.map((row) => <tr key={row.questionId}>
            <th scope="row"><strong>{row.title}</strong><small className="long-id">{row.questionId} · v{row.version} · kunci {row.result.key}</small></th>
            <td><FollowUpPill row={row} /></td>
            <td>{number(row.result.difficulty)}<small className="cell-note">{row.result.difficultyBand ?? ''}</small></td>
            <td>{number(row.result.discrimination)}<small className="cell-note">r pbis {number(row.result.pointBiserial)}</small></td>
            <td>{row.result.effectiveDistractors === null ? (row.result.distractorCount ? '—' : 'Tidak berlaku') : `${row.result.effectiveDistractors} / ${row.result.distractorCount}`}</td>
            <td>{sufficiencyLabel[row.result.sufficiency]}<small className="cell-note">n = {row.result.n}</small></td>
            <td className="action-cell">{followState(row) === 'pending'
              ? <button className="button primary compact table-action" onClick={() => setDetail(row)} aria-label={`Tinjau ${row.title}`}>Tinjau</button>
              : <button className="button secondary compact table-action" onClick={() => setDetail(row)} aria-label={`Detail ${row.title}`}>Detail</button>}</td>
          </tr>)}</tbody>
        </table></div> : <Empty title="Tidak ada soal di tampilan ini" description="Semua soal yang perlu ditinjau sudah diputuskan." />}
      </section>
    </>}
    <section className="card guidance">
      <span className="icon-tile tone-purple"><BookOpen size={21} /></span>
      <div><h2>Rasch / IRT · Analisis Lanjutan</h2><p>Belum tersedia. Menurut BRD, Rasch/IRT masuk tahap 2 dan dijalankan bila data respons dan kecocokan model memadai.</p></div>
    </section>
    {detail && <ResultDialog row={detail} question={questions.find((item) => item.id === detail.questionId)} onClose={() => setDetail(null)}
      onDecided={(question, decision) => {
        onApplied(question)
        setDetail(null)
        reload()
        onToast(`Keputusan disimpan · ${decisionInfo[decision].label}.`)
      }} />}
  </>
}

function FollowUpPill({row}: {row: AnalysisResultRow}) {
  const state = followState(row)
  if (state === 'decided') return <Pill tone={decisionInfo[row.decision!.decision].tone}>{decisionInfo[row.decision!.decision].label}</Pill>
  if (state === 'insufficient') return <Pill tone="gray">Data kurang</Pill>
  if (state === 'none') return <Pill tone="green">Tidak ada</Pill>
  if (state === 'retired') return <Pill tone="gray">Sudah dipensiunkan</Pill>
  if (state === 'in-process') return <Pill tone="purple">{processLabel[row.currentStatus] ?? 'Dalam proses'}</Pill>
  if (state === 'outdated') return <Pill tone="gray">Versi lama</Pill>
  return <Pill tone={priorityInfo[row.priority!].tone}>{priorityInfo[row.priority!].label}</Pill>
}

const stateColor: Record<FollowState, string> = {
  pending: '', decided: '#218665', none: '#9aa8ba', insufficient: '#c5cfdb', retired: '#7386a1', 'in-process': '#8063ca', outdated: '#7386a1',
}
const priorityColor = {high: '#c63c61', medium: '#d89a18', low: '#3269c8'}
const pointColor = (row: AnalysisResultRow) => followState(row) === 'pending' ? priorityColor[row.priority!] : stateColor[followState(row)]
const shortTitle = (title: string) => title.match(/\d{2}/)?.[0] ?? title.slice(0, 3)

/** Peta butir: sumbu x kesukaran p, sumbu y daya pembeda D, dengan batas kategori default. */
function QualityMap({rows, onOpen}: {rows: AnalysisResultRow[]; onOpen: (row: AnalysisResultRow) => void}) {
  const [hover, setHover] = useState<AnalysisResultRow | null>(null)
  const plotted = rows.filter((row) => row.result.difficulty !== null && row.result.discrimination !== null)
  const width = 640, height = 320, left = 44, right = 112, top = 22, bottom = 40
  const minD = Math.min(-0.2, ...plotted.map((row) => row.result.discrimination!))
  const x = (p: number) => left + p * (width - left - right)
  const y = (d: number) => top + (1 - d) / (1 - minD) * (height - top - bottom)
  const dLines = [{value: 0.4, label: 'baik ≥ 0,40'}, {value: 0.3, label: 'cukup'}, {value: 0.2, label: 'perlu perbaikan'}, {value: 0, label: 'jelek < 0,20'}]
  if (!plotted.length) return <Empty title="Belum ada titik untuk dipetakan" description="Soal dengan data belum memadai tidak dipetakan." />
  return <div className="quality-map">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Peta kualitas ${plotted.length} butir: kesukaran terhadap daya pembeda`}>
      <rect x={x(0.3)} y={y(1)} width={x(0.7) - x(0.3)} height={y(0.3) - y(1)} className="map-ideal" rx={6} />
      <text x={x(0.5)} y={y(1) + 15} className="map-zone-label" textAnchor="middle">zona ideal</text>
      {dLines.map(({value, label}) => <g key={value}>
        <line x1={x(0)} x2={x(1)} y1={y(value)} y2={y(value)} className={value === 0 ? 'map-axis' : 'map-grid'} />
        <text x={x(1) + 8} y={y(value) + (value === 0 ? 14 : -4)} className="map-tick">{label}</text>
      </g>)}
      {[0.3, 0.7].map((value) => <line key={value} x1={x(value)} x2={x(value)} y1={y(1)} y2={y(minD)} className="map-grid" />)}
      {[{p: 0.15, label: 'Sukar'}, {p: 0.5, label: 'Sedang'}, {p: 0.85, label: 'Mudah'}].map(({p, label}) =>
        <text key={label} x={x(p)} y={height - 22} className="map-tick" textAnchor="middle">{label}</text>)}
      {[0, 0.3, 0.7, 1].map((value) => <text key={value} x={x(value)} y={height - 8} className="map-tick map-tick-small" textAnchor="middle">{formatDecimal(value)}</text>)}
      <text x={12} y={y(0.5)} className="map-tick" transform={`rotate(-90 12 ${y(0.5)})`} textAnchor="middle">Daya pembeda D</text>
      {plotted.map((row) => {
        const cx = x(row.result.difficulty!), cy = y(row.result.discrimination!)
        const state = followState(row)
        return <g key={row.questionId} className="map-point" tabIndex={0} role="button" aria-label={`${row.title}: p ${number(row.result.difficulty)}, D ${number(row.result.discrimination)}`}
          onClick={() => onOpen(row)} onKeyDown={(event) => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onOpen(row)}}}
          onMouseEnter={() => setHover(row)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(row)} onBlur={() => setHover(null)}>
          <circle cx={cx} cy={cy} r={14} className="map-hit" />
          <circle cx={cx} cy={cy} r={state === 'pending' ? 7 : 6} fill={state === 'decided' ? '#fff' : pointColor(row)} stroke={pointColor(row)} strokeWidth={state === 'decided' ? 2.5 : 2} className="map-dot" />
          <text x={cx + 10} y={cy + 4} className="map-label">{shortTitle(row.title)}</text>
        </g>
      })}
    </svg>
    {hover && <div className="map-tooltip" role="status"><strong>{hover.title}</strong>
      <span>p {number(hover.result.difficulty)} ({hover.result.difficultyBand}) · D {number(hover.result.discrimination)}</span>
      <span><FollowUpPill row={hover} /></span></div>}
    <ul className="map-legend" aria-label="Keterangan warna titik">
      {(['high', 'medium', 'low'] as const).map((level) => <li key={level}><span className="legend-dot" style={{background: priorityColor[level]}} />{priorityInfo[level].label}</li>)}
      <li><span className="legend-dot legend-ring" style={{borderColor: stateColor.decided}} />Sudah diputuskan</li>
      <li><span className="legend-dot" style={{background: stateColor['in-process']}} />Sedang direvisi/review</li>
      <li><span className="legend-dot" style={{background: stateColor.retired}} />Dipensiunkan / versi lama</li>
      <li><span className="legend-dot" style={{background: stateColor.none}} />Tanpa masalah</li>
    </ul>
  </div>
}

/** Ringkasan antrean keputusan sebagai satu batang bertumpuk. */
function FollowUpStatus({rows, pendingAll, onShowPending}: {rows: AnalysisResultRow[]; pendingAll: number; onShowPending: () => void}) {
  const groups = [
    {label: 'Menunggu keputusan · Tinggi', color: priorityColor.high, count: rows.filter((row) => followState(row) === 'pending' && row.priority === 'high').length},
    {label: 'Menunggu keputusan · Sedang', color: priorityColor.medium, count: rows.filter((row) => followState(row) === 'pending' && row.priority === 'medium').length},
    {label: 'Menunggu keputusan · Rendah', color: priorityColor.low, count: rows.filter((row) => followState(row) === 'pending' && row.priority === 'low').length},
    {label: 'Sudah diputuskan', color: stateColor.decided, count: rows.filter((row) => followState(row) === 'decided').length},
    {label: 'Sedang direvisi/review', color: stateColor['in-process'], count: rows.filter((row) => followState(row) === 'in-process').length},
    {label: 'Dipensiunkan / versi lama', color: stateColor.retired, count: rows.filter((row) => ['retired', 'outdated'].includes(followState(row))).length},
    {label: 'Tanpa masalah', color: stateColor.none, count: rows.filter((row) => followState(row) === 'none').length},
    {label: 'Data belum memadai', color: stateColor.insufficient, count: rows.filter((row) => followState(row) === 'insufficient').length},
  ].filter((group) => group.count)
  const waiting = rows.filter((row) => followState(row) === 'pending').length
  return <div className="followup-status">
    <div className="panel-heading"><h2>Status Tindak Lanjut</h2></div>
    <p className="followup-headline"><strong>{waiting}</strong> dari {rows.length} soal menunggu keputusan</p>
    <div className="stacked-bar" role="img" aria-label={groups.map((group) => `${group.label} ${group.count}`).join(', ')}>
      {groups.map((group) => <span key={group.label} style={{flexGrow: group.count, background: group.color}} title={`${group.label}: ${group.count}`} />)}
    </div>
    <ul className="followup-legend">{groups.map((group) => <li key={group.label}><span className="legend-dot" style={{background: group.color}} />{group.label}<strong>{group.count}</strong></li>)}</ul>
    {waiting > 0 && <button className="button secondary compact" onClick={onShowPending}>Lihat yang menunggu keputusan</button>}
    <p className="muted">{pendingAll} soal menunggu keputusan di semua paket. Batas penilaian memakai default sementara (Arikunto, Ebel) yang menunggu persetujuan pakar assessment; keputusan tetap di tangan dosen.</p>
  </div>
}

function ResultDialog({row, question, onClose, onDecided}: {row: AnalysisResultRow; question?: Question; onClose: () => void; onDecided: (question: Question, decision: FollowUpDecision) => void}) {
  const [decision, setDecision] = useState<FollowUpDecision | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const result = row.result
  const canDecide = followState(row) === 'pending' && question
  const closed = closedInfo(row)

  async function submit() {
    if (!decision || !question || pending) return
    if (!reason.trim()) {
      setError('Isi alasan keputusan.')
      return
    }
    setPending(true)
    setError('')
    try {
      const updated = await decideFollowUp(row.runId, row.questionId, decision, reason.trim(), question.revision)
      onDecided(updated, decision)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Keputusan gagal disimpan.')
    } finally {
      setPending(false)
    }
  }

  return <Dialog title={canDecide ? 'Tinjau Hasil Analisis' : 'Detail Hasil Analisis'} wide onClose={onClose}>
    <div className="dialog-content question-detail">
      <div className="detail-meta"><span>{row.questionId} · dianalisis versi {row.version} · {row.owner}</span>{question && <StatusPill status={question.status} />}</div>
      <h3>{row.title}</h3>
      <div className="analysis-pills"><FollowUpPill row={row} />{row.result.followUp?.reasons.map((item) => <Pill key={item} tone="gray">{item}</Pill>)}</div>
      <p className="muted">p {number(result.difficulty)} ({result.difficultyBand ?? '—'}) · D {number(result.discrimination)} · r pbis {number(result.pointBiserial)} · n {result.n} ({sufficiencyLabel[result.sufficiency]}) ·
        distribusi {Object.entries(result.distribution).filter(([, entry]) => entry.count).map(([choice, entry]) => `${choiceLabel[choice] ?? choice} ${entry.count}${choice === result.key ? ' (kunci)' : ''}`).join(', ')}</p>
      <div className="inset"><h4>Interpretasi</h4><ul>{result.interpretation.map((line) => <li key={line}>{line}</li>)}</ul></div>
      <div className="inset"><h4>Saran</h4><ul>{result.recommendations.map((line) => <li key={line}>{line}</li>)}</ul></div>
      {result.notes.length > 0 && <p className="muted">{result.notes.join(' ')}</p>}
      {row.decision && <div className="inset"><h4>Keputusan: {decisionInfo[row.decision.decision].label}</h4><p>{row.decision.reason}</p><p className="muted">@{row.decision.actor} · {formatDate(row.decision.created)}</p></div>}
      {canDecide && <>
        <h4>Tindak lanjut</h4>
        <div className="decision-options" role="group" aria-label="Pilih tindak lanjut">
          {(['keep', 'revise', 'retire'] as const).map((value) => {
            const Icon = value === 'keep' ? ShieldCheck : value === 'revise' ? PencilLine : Archive
            return <button key={value} type="button" className="decision-option" aria-pressed={decision === value}
              onClick={() => {setDecision(value); setError('')}}>
              <strong><Icon size={15} /> {decisionInfo[value].label}</strong><small>{decisionInfo[value].description}</small>
            </button>
          })}
        </div>
        <label className="field">Alasan keputusan<textarea rows={3} maxLength={2000} value={reason} onChange={(event) => {setReason(event.target.value); setError('')}} placeholder="Wajib diisi; dicatat di audit log" /></label>
      </>}
      {closed && <div className="inset closed-note"><h4>Tidak perlu keputusan</h4><p>{closed}</p></div>}
      {followState(row) === 'pending' && !question && <p className="muted">Soal tidak ditemukan di bank soal.</p>}
      {!row.analyzed && <p className="muted">Data soal ini belum memadai, jadi belum ada tindak lanjut yang bisa diputuskan.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    <footer className="dialog-footer">
      <button className="button secondary" onClick={onClose} disabled={pending}>Tutup</button>
      {canDecide && <button className="button primary" disabled={!decision || pending} onClick={() => void submit()}><Check size={17} /> {pending ? 'Menyimpan…' : 'Simpan Keputusan'}</button>}
    </footer>
  </Dialog>
}
