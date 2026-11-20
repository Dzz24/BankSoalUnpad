import { BarChart3, Download, EyeOff, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { analyzeCtt, optionLabel } from '../shared/ctt.js'
import { getQuestionHistory, getWorkspace } from './api'
import { downloadCsv, formatDecimal, type Question, type Tone } from './data'
import { Pill } from './ui'

export type ResponseRow = {id_peserta: string; id_soal: string; versi_soal: string; respons: string}

type Priority = 'high' | 'medium' | 'low'
export type CttItemResult = {
  itemId: string
  version: number
  key: string
  n: number
  sufficiency: 'adequate' | 'indicative' | 'insufficient'
  analyzed: boolean
  difficulty: number | null
  difficultyBand: 'Mudah' | 'Sedang' | 'Sulit' | null
  discrimination: number | null
  pointBiserial: number | null
  distractorCount: number
  effectiveDistractors: number | null
  distribution: Record<string, {count: number}>
  flags: string[]
  followUp: {priority: Priority; reasons: string[]} | null
  interpretation: string[]
  recommendations: string[]
  notes: string[]
}
type CttResult = {
  method: {version: string}
  participantCount: number
  groups: {size: number; notes: string[]}
  items: CttItemResult[]
  test: {averageDifficulty: number | null; averageDiscrimination: number | null; effectiveDistractorShare: number | null; reliability: {kr20: number | null; note: string | null}}
  issues: Array<{type: string; message: string}>
}

export const priorityInfo: Record<Priority, {label: string; tone: Tone}> = {
  high: {label: 'Tinggi', tone: 'red'},
  medium: {label: 'Sedang', tone: 'amber'},
  low: {label: 'Rendah', tone: 'blue'},
}
export const sufficiencyLabel = {adequate: 'Memadai', indicative: 'Indikatif', insufficient: 'Belum memadai'}
const issueLabel: Record<string, string> = {
  'unknown-item': 'Soal atau versi tidak ditemukan di bank soal',
  'missing-row': 'Peserta tanpa baris untuk soal tertentu',
  duplicate: 'Jawaban ganda',
  'participant-missing': 'Baris tanpa ID peserta',
  'invalid-response': 'Respons di luar opsi soal (dihitung salah)',
}
const blankLabel: Record<'incorrect' | 'exclude', string> = {incorrect: 'Dihitung salah', exclude: 'Tidak dihitung'}
export const choiceLabel: Record<string, string> = {blank: 'kosong', invalid: 'tidak valid', missing: 'tanpa baris'}
const countOf = (item: {distribution: Record<string, {count: number}>}, choice: string) => item.distribution[choice]?.count ?? 0
const number = (value: number | null) => value === null ? '—' : formatDecimal(value)

/** Mengambil kunci tiap versi soal dari data aplikasi. Versi lama diambil dari riwayat soal. */
async function loadItems(rows: ResponseRow[], questions: Question[]) {
  const wanted = new Map<string, {id: string; version: number}>()
  for (const row of rows) {
    const version = Number(row.versi_soal)
    if (Number.isInteger(version)) wanted.set(`${row.id_soal}@${version}`, {id: row.id_soal, version})
  }
  const histories = new Map<string, Promise<Question[]>>()
  const items = []
  for (const {id, version} of wanted.values()) {
    const current = questions.find((question) => question.id === id)
    if (!current) continue
    let snapshot: Question | undefined = current.version === version ? current : undefined
    if (!snapshot) {
      if (!histories.has(id)) histories.set(id, getQuestionHistory(id).then((history) => history.versions.map((entry) => entry.snapshot)).catch(() => []))
      snapshot = (await histories.get(id))?.find((entry) => entry.version === version)
    }
    if (snapshot) items.push({itemId: id, version, key: optionLabel(snapshot.answer), optionCount: snapshot.options.length, format: snapshot.format})
  }
  return items
}

type BlankRule = 'incorrect' | 'exclude'
type View = 'all' | 'follow-up'

export function CttPreview({rows, questions}: {rows: ResponseRow[]; questions: Question[]}) {
  const [open, setOpen] = useState(false)
  const [blank, setBlank] = useState<BlankRule>('incorrect')
  const [view, setView] = useState<View>('all')
  const [result, setResult] = useState<CttResult | null>(null)
  const [previous, setPrevious] = useState<{rule: BlankRule; result: CttResult} | null>(null)
  const [computedAt, setComputedAt] = useState<Date | null>(null)
  const [bank, setBank] = useState<Question[]>(questions)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const titles = new Map(bank.map((question) => [question.id, question.title]))

  // Kunci selalu diambil ulang dari database setiap kali dihitung, jadi perubahan soal langsung terbawa.
  async function run(rule: BlankRule, compareWith: {rule: BlankRule; result: CttResult} | null = null) {
    setPrevious(compareWith)
    setPending(true)
    setError('')
    try {
      const latest = await getWorkspace().then((workspace) => workspace.questions).catch(() => questions)
      setBank(latest)
      const items = await loadItems(rows, latest)
      if (!items.length) throw new Error('Tidak ada ID dan versi soal di file yang cocok dengan bank soal.')
      const responses = rows.map((row) => ({participantId: row.id_peserta, itemId: row.id_soal, version: row.versi_soal, response: row.respons}))
      setResult(analyzeCtt({responses, items, options: {blank: rule}}) as unknown as CttResult)
      setComputedAt(new Date())
    } catch (error) {
      setResult(null)
      setError(error instanceof Error ? error.message : 'Analisis gagal dijalankan.')
    } finally {
      setPending(false)
    }
  }

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    void run(blank)
  }

  function changeBlank(rule: BlankRule) {
    const before = result ? {rule: blank, result} : null
    setBlank(rule)
    void run(rule, before)
  }

  function download() {
    if (!result) return
    downloadCsv('pratinjau-analisis-ctt.csv', [
      ['id_soal', 'versi_soal', 'kunci', 'n', 'proporsi_benar', 'kategori', 'daya_pembeda_d', 'point_biserial', 'pengecoh_efektif', 'status_data', 'prioritas_tindak_lanjut', 'rekomendasi', 'aturan_kosong', 'versi_metode'],
      ...result.items.map((item) => [item.itemId, String(item.version), item.key, String(item.n), number(item.difficulty), item.difficultyBand ?? '', number(item.discrimination), number(item.pointBiserial),
        item.effectiveDistractors === null ? '' : `${item.effectiveDistractors}/${item.distractorCount}`, sufficiencyLabel[item.sufficiency],
        item.followUp ? priorityInfo[item.followUp.priority].label : '', item.recommendations.join(' '), blankLabel[blank], result.method.version]),
    ])
  }

  const issueCounts = result ? Object.entries(result.issues.reduce<Record<string, number>>((counts, issue) => ({...counts, [issue.type]: (counts[issue.type] ?? 0) + 1}), {})) : []
  const invalidCount = result ? result.items.reduce((sum, item) => sum + (item.distribution.invalid?.count ?? 0), 0) : 0
  if (invalidCount) issueCounts.push(['invalid-response', invalidCount])
  const kr20 = result?.test.reliability.kr20 ?? null
  const priorityCounts = result ? (['high', 'medium', 'low'] as Priority[]).map((level) => [level, result.items.filter((item) => item.followUp?.priority === level).length] as const) : []
  const shown = result ? result.items.filter((item) => view === 'all' || item.followUp) : []
  const affected = result ? result.items.filter((item) => countOf(item, 'blank') + countOf(item, 'invalid') + countOf(item, 'missing') > 0) : []
  const before = new Map(previous?.result.items.map((item) => [`${item.itemId}@${item.version}`, item]))
  const changed = (item: CttItemResult) => {
    const old = before.get(`${item.itemId}@${item.version}`)
    return Boolean(old && (old.n !== item.n || old.difficulty !== item.difficulty || old.discrimination !== item.discrimination || old.pointBiserial !== item.pointBiserial))
  }

  return <section className="ctt-preview" aria-label="Pratinjau analisis CTT">
    <div className="ctt-preview-head">
      <button className={open ? 'button primary' : 'button secondary'} aria-pressed={open} aria-expanded={open} onClick={toggle}>
        {open ? <><EyeOff size={16} /> Tutup Pratinjau CTT</> : <><BarChart3 size={16} /> Pratinjau Analisis CTT</>}
      </button>
      {open && result && <button className="text-button" onClick={download}><Download size={16} /> Unduh Hasil CSV</button>}
    </div>
    {open && <>
      <div className="ctt-controls">
        <label className="field">Respons kosong
          <select value={blank} disabled={pending} onChange={(event) => changeBlank(event.target.value as BlankRule)}>
            <option value="incorrect">Dihitung salah (default)</option>
            <option value="exclude">Tidak dihitung</option>
          </select>
        </label>
        <label className="field">Tampilkan
          <select value={view} onChange={(event) => setView(event.target.value as View)}>
            <option value="all">Semua soal</option>
            <option value="follow-up">Hanya yang perlu ditindaklanjuti</option>
          </select>
        </label>
        <button className="button secondary" disabled={pending} onClick={() => void run(blank)}><RefreshCw size={16} /> {pending ? 'Menghitung…' : 'Hitung Ulang'}</button>
      </div>
      {result && <p className="muted" role="status">{affected.length
        ? `Aturan respons kosong hanya memengaruhi soal yang punya respons kosong atau tidak valid: ${affected.map((item) => `${titles.get(item.itemId) ?? item.itemId} (${countOf(item, 'blank') + countOf(item, 'missing')} kosong${countOf(item, 'invalid') ? `, ${countOf(item, 'invalid')} tidak valid` : ''})`).join('; ')}. Soal lain tidak berubah.`
        : 'File ini tidak memuat respons kosong atau tidak valid, jadi pilihan aturan respons kosong tidak mengubah hasil.'}</p>}
      {pending && !result && <p className="muted" role="status">Mengambil kunci dari bank soal dan menghitung…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <>
        <div className="inset"><strong>Pratinjau — hasil belum disimpan</strong>
          <p>Dihitung {computedAt?.toLocaleTimeString('id-ID')} dari {rows.length} baris respons, memakai kunci versi soal yang tersimpan di database saat itu. Aturan respons kosong: {blankLabel[blank].toLowerCase()}. Batas penilaian memakai default sementara (metode CTT v{result.method.version}) yang menunggu persetujuan pakar assessment. Hasil ini bahan pertimbangan, bukan keputusan otomatis.</p></div>
        <p><strong>{result.participantCount} peserta</strong> · {result.items.length} soal · kelompok atas/bawah {result.groups.size} peserta · rata-rata p {number(result.test.averageDifficulty)} · rata-rata D {number(result.test.averageDiscrimination)} · KR-20 {kr20 === null ? '—' : formatDecimal(kr20)}</p>
        <p className="ctt-priority-summary">{priorityCounts.map(([level, count]) => <Pill key={level} tone={priorityInfo[level].tone}>{priorityInfo[level].label}: {count}</Pill>)}
          <Pill tone="green">Tidak ada: {result.items.filter((item) => !item.followUp).length}</Pill></p>
        {result.test.reliability.note && <p className="muted">{result.test.reliability.note}</p>}
        {issueCounts.length > 0 && <div className="inset ctt-issues" role="status"><strong>Peringatan data</strong>
          <p>{issueCounts.map(([type, count]) => `${issueLabel[type] ?? type}: ${count}`).join('\n')}</p></div>}
        {shown.length ? <>
          <div className="table-scroll" tabIndex={0} aria-label="Tabel pratinjau hasil CTT"><table>
            <thead><tr><th>Soal</th><th>Tindak Lanjut</th><th>Kesukaran</th><th>Daya Pembeda</th><th>Pengecoh</th><th>Data</th></tr></thead>
            <tbody>{shown.map((item) => <tr key={`${item.itemId}@${item.version}`} className={changed(item) ? 'ctt-changed' : undefined}>
              <th scope="row"><strong>{titles.get(item.itemId) ?? item.itemId}</strong><small>{item.itemId} · v{item.version} · kunci {item.key}</small></th>
              <td>{item.followUp ? <Pill tone={priorityInfo[item.followUp.priority].tone}>{priorityInfo[item.followUp.priority].label}</Pill> : <Pill tone="green">Tidak ada</Pill>}</td>
              <td>{number(item.difficulty)}<small>{item.difficultyBand ?? ''}</small></td>
              <td>{number(item.discrimination)}<small>r pbis {number(item.pointBiserial)}</small></td>
              <td>{item.effectiveDistractors === null ? (item.distractorCount ? '—' : 'Tidak berlaku') : `${item.effectiveDistractors} / ${item.distractorCount}`}</td>
              <td>{sufficiencyLabel[item.sufficiency]}<small>n = {item.n} dari {result.participantCount}{countOf(item, 'blank') + countOf(item, 'missing') ? ` · kosong ${countOf(item, 'blank') + countOf(item, 'missing')}` : ''}{countOf(item, 'invalid') ? ` · tidak valid ${countOf(item, 'invalid')}` : ''}</small>
                {changed(item) && <small className="ctt-changed-note">Berubah dari aturan “{blankLabel[previous!.rule].toLowerCase()}”: p {number(before.get(`${item.itemId}@${item.version}`)!.difficulty)}, D {number(before.get(`${item.itemId}@${item.version}`)!.discrimination)}, n {before.get(`${item.itemId}@${item.version}`)!.n}</small>}</td>
            </tr>)}</tbody>
          </table></div>
          <div className="ctt-details">{shown.map((item) => <details key={`${item.itemId}@${item.version}`}>
            <summary><strong>{titles.get(item.itemId) ?? item.itemId}</strong> {item.followUp ? `— ${item.followUp.reasons.join(', ')}` : '— tidak ada masalah menonjol'}</summary>
            <p className="muted">{item.itemId} · v{item.version} · distribusi {Object.entries(item.distribution).filter(([, entry]) => entry.count).map(([choice, entry]) => `${choiceLabel[choice] ?? choice} ${entry.count}`).join(', ')}</p>
            <ul>{item.interpretation.map((line) => <li key={line}>{line}</li>)}</ul>
            <p><strong>Saran:</strong></p>
            <ul>{item.recommendations.map((line) => <li key={line}>{line}</li>)}</ul>
            {item.notes.length > 0 && <p className="muted">{item.notes.join(' ')}</p>}
          </details>)}</div>
        </> : <p className="muted">Tidak ada soal yang perlu ditindaklanjuti pada hasil ini.</p>}
      </>}
    </>}
  </section>
}
