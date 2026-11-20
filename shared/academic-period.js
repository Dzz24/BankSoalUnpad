// Periode ujian dibuat dari pilihan baku (semester + tahun akademik), bukan teks bebas.
export const semesters = /** @type {const} */ (['Ganjil', 'Genap', 'Antara'])

/** Tahun akademik berjalan: mulai Agustus. Mengembalikan tahun awal, misalnya 2026 untuk 2026/2027. */
export function currentAcademicStart(date = new Date()) {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1
}

/** Pilihan tahun akademik: tiga tahun ke belakang sampai tahun berjalan. */
export function academicYears(date = new Date()) {
  const start = currentAcademicStart(date)
  return [0, 1, 2, 3].map((offset) => `${start - offset}/${start - offset + 1}`)
}

/** Semester bawaan menurut bulan: Agustus–Januari Ganjil, Februari–Juli Genap. */
export function defaultSemester(date = new Date()) {
  const month = date.getMonth()
  return month >= 7 || month === 0 ? 'Ganjil' : 'Genap'
}

export function formatPeriod(semester, year) {
  return `${semester} ${year}`
}

/** Periode sah: "<Ganjil|Genap|Antara> YYYY/YYYY+1" dan tidak melewati tahun akademik berjalan. */
export function isValidPeriod(value, date = new Date()) {
  const match = /^(Ganjil|Genap|Antara) (\d{4})\/(\d{4})$/.exec(String(value ?? ''))
  if (!match) return false
  const first = Number(match[2])
  return Number(match[3]) === first + 1 && first >= 2000 && first <= currentAcademicStart(date)
}
