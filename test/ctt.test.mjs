// Angka harapan diambil dari hitungan manual di docs/ctt-hitung-manual.md.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import Papa from 'papaparse'
import { analyzeCtt, CTT_METHOD_VERSION, CTT_TOLERANCE, optionLabel, responsesFromCsvRows } from '../shared/ctt.js'

function readFixture(name) {
  const source = readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8')
  return Papa.parse(source, {header: true, skipEmptyLines: 'greedy', transform: (value) => value.trim()}).data
}

const responses = responsesFromCsvRows(readFixture('ctt-respons-contoh.csv'))
const items = readFixture('ctt-kunci-contoh.csv').map((row) => ({itemId: row.id_soal, version: row.versi_soal, key: row.kunci, optionCount: Number(row.jumlah_opsi), format: row.format}))
// Toleransi acuan NFR-14 (CTT_TOLERANCE = 0,001).
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < CTT_TOLERANCE, `${actual} ≠ ${expected}`)
const byId = (result, id) => result.items.find((item) => item.itemId === id)

describe('analisis CTT dengan data contoh (kosong dihitung salah)', () => {
  const result = analyzeCtt({responses, items})

  test('kelompok atas dan bawah 27% dari 10 peserta = 3 orang', () => {
    assert.equal(result.participantCount, 10)
    assert.equal(result.groups.size, 3)
    assert.deepEqual(result.groups.notes, [])
    const withIds = analyzeCtt({responses, items, options: {includeParticipantIds: true}})
    assert.deepEqual(withIds.groups.upper, ['P01', 'P02', 'P03'])
    assert.deepEqual(withIds.groups.lower, ['P08', 'P09', 'P10'])
  })

  test('ID peserta kelompok tidak disertakan secara bawaan', () => {
    assert.equal(result.groups.upper, undefined)
    assert.equal(result.groups.lower, undefined)
  })

  test('metadata metode tercatat', () => {
    assert.equal(result.method.name, 'CTT')
    assert.equal(result.method.version, CTT_METHOD_VERSION)
    assert.equal(result.method.settings.blank, 'incorrect')
    assert.ok(!Number.isNaN(Date.parse(result.method.computedAt)))
  })

  test('interpretasi dan rekomendasi bahasa sederhana', () => {
    const first = byId(result, 'CTT-01')
    assert.equal(first.interpretation[0], 'Soal tergolong mudah: 80% peserta menjawab benar.')
    assert.ok(first.interpretation.some((line) => line.startsWith('Daya pembeda baik (0,67)')))
    assert.ok(first.recommendations.includes('Opsi C, D tidak dipilih siapa pun; pertimbangkan mengganti pengecoh ini.'))
    assert.deepEqual(byId(result, 'CTT-05').recommendations, ['Tidak ada masalah yang menonjol; soal dapat dipertahankan.'])
    assert.ok(result.items.every((item) => item.analyzed))
  })

  test('proporsi benar', () => {
    const expected = {'CTT-01': 0.8, 'CTT-02': 0.5, 'CTT-03': 0.4, 'CTT-04': 0.2, 'CTT-05': 0.7}
    for (const [id, p] of Object.entries(expected)) close(byId(result, id).difficulty, p)
    assert.deepEqual(result.items.map((item) => item.difficultyBand), ['Mudah', 'Sedang', 'Sedang', 'Sulit', 'Mudah'])
  })

  test('daya pembeda D = pA - pB', () => {
    const expected = {'CTT-01': [3, 1, 2 / 3], 'CTT-02': [3, 0, 1], 'CTT-03': [3, 0, 1], 'CTT-04': [2, 0, 2 / 3], 'CTT-05': [2, 1, 1 / 3]}
    for (const [id, [upper, lower, d]] of Object.entries(expected)) {
      const item = byId(result, id)
      assert.equal(item.upperCorrect, upper)
      assert.equal(item.lowerCorrect, lower)
      close(item.discrimination, d)
    }
  })

  test('point-biserial terkoreksi', () => {
    const expected = {'CTT-01': 0.5204, 'CTT-02': 0.6163, 'CTT-03': 0.5601, 'CTT-04': 0.4295, 'CTT-05': 0.1111}
    for (const [id, r] of Object.entries(expected)) close(byId(result, id).pointBiserial, r)
  })

  test('distribusi pilihan memisahkan kosong dan tidak valid', () => {
    const first = byId(result, 'CTT-01').distribution
    assert.deepEqual([first.A.count, first.B.count, first.C.count, first.D.count, first.blank.count], [8, 1, 0, 0, 1])
    const third = byId(result, 'CTT-03').distribution
    assert.deepEqual([third.A.count, third.B.count, third.C.count, third.D.count, third.invalid.count], [1, 3, 4, 1, 1])
  })

  test('pengecoh efektif dan soal Benar/Salah', () => {
    assert.deepEqual(result.items.map((item) => item.effectiveDistractors), [1, 2, 2, 2, null])
    const effective = Object.fromEntries(result.items.filter((item) => item.distractors).map((item) => [item.itemId, item.distractors.filter((d) => d.effective).map((d) => d.option)]))
    assert.deepEqual(effective, {'CTT-01': ['B'], 'CTT-02': ['A', 'D'], 'CTT-03': ['B', 'D'], 'CTT-04': ['A', 'C']})
    assert.equal(byId(result, 'CTT-05').distractors, null)
    close(result.test.effectiveDistractorShare, 7 / 12)
  })

  test('penanda dan status data', () => {
    // D terendah 0,333 (CTT-05) masih di atas batas 0,25; semua soal PG punya pengecoh yang belum berfungsi.
    assert.deepEqual(result.items.map((item) => item.flags), [['distractor-review'], ['distractor-review'], ['distractor-review'], ['distractor-review'], []])
    const stricter = analyzeCtt({responses, items, options: {lowDiscrimination: 0.4}})
    assert.deepEqual(byId(stricter, 'CTT-05').flags, ['low-discrimination'])
    assert.ok(result.items.every((item) => item.sufficiency === 'indicative'))
  })

  test('ringkasan tes dan KR-20', () => {
    close(result.test.scoreMean, 2.6)
    close(result.test.scoreVariance, 2.24)
    close(result.test.averageDifficulty, 0.52)
    close(result.test.averageDiscrimination, (2 / 3 + 1 + 1 + 2 / 3 + 1 / 3) / 5)
    close(result.test.reliability.kr20, 1.25 * (1 - 1.02 / 2.24))
  })
})

describe('aturan kosong = exclude', () => {
  const result = analyzeCtt({responses, items, options: {blank: 'exclude'}})

  test('respons kosong dan tidak valid keluar dari pembagi', () => {
    assert.equal(byId(result, 'CTT-01').n, 9)
    assert.equal(byId(result, 'CTT-03').n, 9)
  })

  test('n di bawah 10 berarti data belum memadai', () => {
    const item = byId(result, 'CTT-01')
    assert.equal(item.sufficiency, 'insufficient')
    assert.equal(item.analyzed, false)
    assert.match(item.interpretation[0], /Data belum cukup/)
    assert.equal(item.difficulty, null)
    assert.equal(item.discrimination, null)
    assert.equal(item.distribution.A.count, 8)
  })

  test('KR-20 tidak dihitung bila matriks tidak lengkap', () => {
    assert.equal(result.test.reliability.kr20, null)
    assert.match(result.test.reliability.note, /exclude/)
  })
})

describe('validasi input', () => {
  test('baris ganda, versi soal tak dikenal, dan baris hilang dilaporkan', () => {
    const extra = [
      {participantId: 'P01', itemId: 'CTT-01', version: 1, response: 'B'},
      {participantId: 'P01', itemId: 'CTT-01', version: 2, response: 'A'},
    ]
    const withoutRow = responses.filter((row) => !(row.participantId === 'P02' && row.itemId === 'CTT-02'))
    const result = analyzeCtt({responses: [...withoutRow, ...extra], items})
    assert.deepEqual(result.issues.map((issue) => issue.type).sort(), ['duplicate', 'missing-row', 'unknown-item'])
    assert.equal(byId(result, 'CTT-01').distribution.A.count, 8)
    assert.equal(byId(result, 'CTT-02').distribution.missing.count, 1)
  })

  test('kunci di luar opsi ditolak', () => {
    assert.throws(() => analyzeCtt({responses, items: [{itemId: 'X', version: 1, key: 'E', optionCount: 4}]}), /tidak ada di antara opsi/)
  })

  test('indeks kunci aplikasi diubah ke huruf opsi', () => {
    assert.deepEqual([0, 1, 3].map(optionLabel), ['A', 'B', 'D'])
  })

  test('skor yang sama di batas kelompok diberi catatan', () => {
    const tie = ['P1', 'P2', 'P3', 'P4'].flatMap((id, index) => [
      {participantId: id, itemId: 'T1', version: 1, response: index < 3 ? 'A' : 'B'},
    ])
    const result = analyzeCtt({responses: tie, items: [{itemId: 'T1', version: 1, key: 'A', optionCount: 4}], options: {minParticipants: 1}})
    assert.ok(result.groups.notes.some((note) => note.includes('kelompok atas')))
  })
})

describe('penanda kunci perlu dicek', () => {
  // G1–G4 soal normal (P1–P5 benar). K1 diberi kunci A, padahal sebagian besar kelompok atas memilih B.
  const good = (id) => ['P1', 'P2', 'P3', 'P4', 'P5'].includes(id) ? 'A' : 'C'
  const k1 = {P1: 'B', P2: 'B', P3: 'B', P4: 'B', P5: 'A', P6: 'A', P7: 'A', P8: 'A', P9: 'A', P10: 'C'}
  const rows = Object.entries(k1).flatMap(([id, answer]) => [
    ...['G1', 'G2', 'G3', 'G4'].map((itemId) => ({participantId: id, itemId, version: 1, response: good(id)})),
    {participantId: id, itemId: 'K1', version: 1, response: answer},
  ])
  const bank = ['G1', 'G2', 'G3', 'G4', 'K1'].map((itemId) => ({itemId, version: 1, key: 'A', optionCount: 4}))
  const result = analyzeCtt({responses: rows, items: bank})
  const suspect = byId(result, 'K1')

  test('daya pembeda negatif dan opsi saingan memicu penanda', () => {
    close(suspect.discrimination, -1 / 3)
    assert.ok(suspect.flags.includes('key-check'))
    assert.ok(suspect.recommendations.some((line) => line.startsWith('Periksa kunci jawaban: opsi B lebih banyak dipilih kelompok atas daripada kunci A')))
    assert.match(suspect.interpretation[1], /Daya pembeda negatif/)
  })

  test('soal normal tidak diberi penanda kunci', () => {
    for (const id of ['G1', 'G2', 'G3', 'G4']) assert.ok(!byId(result, id).flags.includes('key-check'), id)
  })
})

describe('kinerja (NFR-03)', () => {
  test('200 peserta × 100 soal selesai jauh di bawah 2 menit', () => {
    const bank = Array.from({length: 100}, (_, index) => ({itemId: `S${index}`, version: 1, key: 'ABCD'[index % 4], optionCount: 4}))
    let seed = 1
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const rows = []
    for (let person = 0; person < 200; person += 1) {
      const ability = random()
      for (const item of bank) rows.push({participantId: `P${person}`, itemId: item.itemId, version: 1, response: random() < 0.3 + 0.6 * ability ? item.key : 'ABCD'[Math.floor(random() * 4)]})
    }
    const started = performance.now()
    const result = analyzeCtt({responses: rows, items: bank})
    const elapsed = performance.now() - started
    assert.equal(result.items.length, 100)
    assert.ok(result.test.reliability.kr20 > 0)
    assert.ok(elapsed < 10_000, `analisis memakan ${Math.round(elapsed)} ms`)
  })
})
