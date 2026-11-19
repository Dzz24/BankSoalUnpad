// Demo analisis CTT dari file CSV.
// Pemakaian:
//   npm run ctt:demo
//   npm run ctt:demo -- --respons path/respons.csv --kunci path/kunci.csv --kosong exclude --out laporan.csv
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import Papa from 'papaparse'
import { analyzeCtt, responsesFromCsvRows } from '../shared/ctt.js'
import { serializeCsv } from '../shared/csv.js'

const fixtures = new URL('../test/fixtures/', import.meta.url)
const {values} = parseArgs({options: {
  respons: {type: 'string', default: fileURLToPath(new URL('ctt-respons-contoh.csv', fixtures))},
  kunci: {type: 'string', default: fileURLToPath(new URL('ctt-kunci-contoh.csv', fixtures))},
  kosong: {type: 'string', default: 'incorrect'},
  out: {type: 'string'},
}})

function readCsv(path) {
  const parsed = Papa.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''), {
    header: true, skipEmptyLines: 'greedy', transformHeader: (value) => value.trim().toLowerCase(), transform: (value) => value.trim(),
  })
  if (parsed.errors.length) throw new Error(`${path}: ${parsed.errors[0].message}`)
  return parsed.data
}

const items = readCsv(values.kunci).map((row) => ({itemId: row.id_soal, version: row.versi_soal, key: row.kunci, optionCount: Number(row.jumlah_opsi), format: row.format}))
const result = analyzeCtt({responses: responsesFromCsvRows(readCsv(values.respons)), items, options: {blank: values.kosong}})

const fixed = (value, digits = 3) => value === null || value === undefined ? '' : value.toFixed(digits)
const distractorText = (item) => item.distractors ? `${item.effectiveDistractors}/${item.distractorCount}` : item.distractorCount ? '' : 'tidak berlaku'
const distribution = (item) => Object.entries(item.distribution).filter(([, entry]) => entry.count).map(([choice, entry]) => `${choice}=${entry.count}`).join(' ')

console.log(`Peserta: ${result.participantCount} · Soal: ${result.itemCount} · Kelompok atas/bawah: ${result.groups.size} peserta · Kosong: ${result.method.settings.blank} · Metode ${result.method.name} v${result.method.version}`)
console.table(result.items.map((item) => ({
  soal: `${item.itemId} v${item.version}`,
  kunci: item.key,
  n: item.n,
  p: fixed(item.difficulty),
  kategori: item.difficultyBand ?? '',
  D: fixed(item.discrimination),
  rpbis: fixed(item.pointBiserial),
  pengecoh: distractorText(item),
  distribusi: distribution(item),
  status: item.sufficiency,
  penanda: item.flags.join(', '),
})))
const test = result.test
console.log(`Rata-rata p ${fixed(test.averageDifficulty)} · rata-rata D ${fixed(test.averageDiscrimination)} · pengecoh efektif ${test.effectiveDistractorShare === null ? '—' : Math.round(test.effectiveDistractorShare * 100) + '%'} · KR-20 ${test.reliability.kr20 === null ? '— (' + test.reliability.note + ')' : fixed(test.reliability.kr20)}`)
for (const note of result.groups.notes) console.log(`Catatan: ${note}`)
for (const item of result.items) {
  console.log(`\n${item.itemId} v${item.version}${item.analyzed ? '' : ' (belum dapat dinyatakan sudah dianalisis)'}`)
  for (const line of item.interpretation) console.log(`  · ${line}`)
  for (const line of item.recommendations) console.log(`  → ${line}`)
  for (const note of item.notes) console.log(`  catatan: ${note}`)
}
for (const issue of result.issues) console.log(`Peringatan: ${issue.message}`)

if (values.out) {
  const header = ['id_soal', 'versi_soal', 'kunci', 'n', 'proporsi_benar', 'kategori', 'daya_pembeda_d', 'benar_kelompok_atas', 'benar_kelompok_bawah', 'point_biserial_terkoreksi', 'pengecoh_efektif', 'jumlah_pengecoh', 'distribusi', 'status_data', 'sudah_dianalisis', 'penanda', 'interpretasi', 'rekomendasi', 'catatan', 'versi_metode']
  const rows = result.items.map((item) => [item.itemId, item.version, item.key, item.n, fixed(item.difficulty), item.difficultyBand ?? '', fixed(item.discrimination), item.upperCorrect ?? '', item.lowerCorrect ?? '', fixed(item.pointBiserial),
    item.effectiveDistractors ?? (item.distractorCount ? '' : 'tidak berlaku'), item.distractorCount, distribution(item), item.sufficiency, item.analyzed ? 'ya' : 'tidak', item.flags.join('; '), item.interpretation.join(' '), item.recommendations.join(' '), item.notes.join(' '), result.method.version])
  writeFileSync(values.out, serializeCsv([header, ...rows]))
  console.log(`Laporan disimpan ke ${values.out}`)
}
