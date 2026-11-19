// Angka harapan diambil dari hitungan manual di docs/ctt-hitung-manual.md.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import Papa from 'papaparse'
import { analyzeCtt, optionLabel, responsesFromCsvRows } from '../shared/ctt.js'

function readFixture(name) {
  const source = readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8')
  return Papa.parse(source, {header: true, skipEmptyLines: 'greedy', transform: (value) => value.trim()}).data
}

const responses = responsesFromCsvRows(readFixture('ctt-respons-contoh.csv'))
const items = readFixture('ctt-kunci-contoh.csv').map((row) => ({itemId: row.id_soal, version: row.versi_soal, key: row.kunci, optionCount: Number(row.jumlah_opsi), format: row.format}))
const close = (actual, expected, digits = 4) => assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} ≠ ${expected}`)
const byId = (result, id) => result.items.find((item) => item.itemId === id)

describe('analisis CTT dengan data contoh (kosong dihitung salah)', () => {
  const result = analyzeCtt({responses, items})

  test('kelompok atas dan bawah 27% dari 10 peserta = 3 orang', () => {
    assert.equal(result.participantCount, 10)
    assert.equal(result.groups.size, 3)
    assert.deepEqual(result.groups.upper, ['P01', 'P02', 'P03'])
    assert.deepEqual(result.groups.lower, ['P08', 'P09', 'P10'])
    assert.deepEqual(result.groups.notes, [])
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
    for (const [id, r] of Object.entries(expected)) close(byId(result, id).pointBiserial, r, 3)
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
