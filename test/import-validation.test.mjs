import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { validateResponses } from '../server/analysis.mjs'

const items = [
  {id: 'BS-A', version: 2, snapshot: {options: ['a', 'b', 'c', 'd']}},
  {id: 'BS-B', version: 1, snapshot: {options: ['Benar', 'Salah']}},
]
const row = (id_peserta, id_soal, versi_soal, respons) => ({id_peserta, id_soal, versi_soal, respons})

describe('validasi impor respons terhadap paket', () => {
  test('file lengkap dan benar diterima', () => {
    const result = validateResponses([row('P1', 'BS-A', '2', 'c'), row('P1', 'BS-B', '1', ''), row('P2', 'BS-A', '2', 'A'), row('P2', 'BS-B', '1', 'B')], items)
    assert.equal(result.errorCount, 0)
    assert.equal(result.participantCount, 2)
    assert.deepEqual(result.clean[0], {participant: 'P1', questionId: 'BS-A', version: 2, response: 'C'})
  })

  test('setiap masalah dilaporkan dengan nomor baris', () => {
    const result = validateResponses([
      row('P1', 'BS-A', '1', 'A'),
      row('P1', 'BS-B', '1', 'C'),
      row('P1', 'BS-X', '1', 'A'),
      row('P 2', 'BS-A', '2', 'A'),
      row('P3', 'BS-A', '2', 'A'),
      row('P3', 'BS-A', '2', 'B'),
    ], items)
    const messages = result.errors.map((error) => `${error.row}: ${error.message}`)
    assert.match(messages[0], /^2: versi 1 tidak sesuai; paket memakai versi 2/)
    assert.match(messages[1], /^3: respons C tidak ada di opsi A\/B/)
    assert.match(messages[2], /^4: soal BS-X tidak ada di paket ini/)
    assert.match(messages[3], /^5: ID peserta/)
    assert.match(messages[4], /^7: jawaban ganda/)
    assert.ok(messages.some((message) => message.startsWith('null: Peserta P3 belum punya baris untuk 1 soal (BS-B)')))
  })
})

describe('periode ujian baku', async () => {
  const {academicYears, defaultSemester, isValidPeriod} = await import('../shared/academic-period.js')
  const november2026 = new Date(2026, 10, 20)

  test('hanya format semester + tahun akademik yang diterima', () => {
    assert.ok(isValidPeriod('Ganjil 2026/2027', november2026))
    assert.ok(isValidPeriod('Antara 2024/2025', november2026))
    for (const value of ['ganjil 2026/2027', 'Ganjil 2026/2028', 'Ganjil 2027/2028', 'Semester iseng', 'Ganjil 2026/2027 <b>', '']) {
      assert.equal(isValidPeriod(value, november2026), false, value)
    }
  })

  test('pilihan tahun dan semester bawaan mengikuti tanggal', () => {
    assert.deepEqual(academicYears(november2026), ['2026/2027', '2025/2026', '2024/2025', '2023/2024'])
    assert.equal(defaultSemester(november2026), 'Ganjil')
    assert.equal(defaultSemester(new Date(2027, 2, 1)), 'Genap')
  })
})
