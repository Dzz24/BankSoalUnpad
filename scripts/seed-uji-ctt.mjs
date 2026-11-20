// Membuat 10 soal uji CTT (Basis Data), menyetujuinya, menyusun satu paket, lalu menulis CSV respons uji.
// Khusus database eksperimen. Pemakaian (PowerShell, dengan $env:DATABASE_URL mengarah ke bank_soal_exp):
//   node scripts/seed-uji-ctt.mjs
// Opsi: --out <folder> (bawaan storage/uji-ctt-exp), --actor <nama_pengguna> (bawaan rizki), --force (izinkan database selain *_exp)
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { serializeCsv } from '../shared/csv.js'
import { createPool } from '../server/database.mjs'
import { openWorkspace } from '../server/workspace.mjs'

const {values} = parseArgs({options: {out: {type: 'string', default: 'storage/uji-ctt-exp'}, actor: {type: 'string', default: 'rizki'}, force: {type: 'boolean', default: false}}})
const pool = createPool()
const database = new URL(process.env.DATABASE_URL ?? 'postgresql://x/x').pathname.slice(1)
if (!database.endsWith('_exp') && !values.force) {
  console.error(`Database "${database}" bukan database eksperimen (*_exp). Skrip dihentikan agar data utama tidak terisi soal uji. Pakai --force bila memang disengaja.`)
  await pool.end().catch(() => {})
  process.exit(1)
}

const account = {username: values.actor, name: 'M Rizky Khatami'}
const course = 'Basis Data'
const soal = [
  {title: 'Uji CTT 01 – Fungsi Kunci Primer', topic: 'Kunci relasi', level: 'Memahami', format: 'Pilihan Ganda', stem: 'Apa fungsi utama kunci primer (primary key) pada sebuah tabel relasional?', options: ['Mengidentifikasi setiap baris secara unik', 'Mempercepat semua jenis kueri', 'Menghubungkan tabel ke basis data lain', 'Menyimpan nilai default kolom'], answer: 0, explanation: 'Kunci primer menjamin setiap baris dapat dibedakan secara unik dan tidak bernilai NULL.'},
  {title: 'Uji CTT 02 – Menampilkan Semua Kolom', topic: 'SQL dasar', level: 'Mengingat', format: 'Pilihan Ganda', stem: 'Perintah SQL mana yang menampilkan seluruh kolom dari tabel mahasiswa?', options: ['SHOW mahasiswa', 'SELECT * FROM mahasiswa', 'GET ALL mahasiswa', 'SELECT mahasiswa.*ALL'], answer: 1, explanation: 'Tanda * pada SELECT berarti semua kolom.'},
  {title: 'Uji CTT 03 – Ketergantungan Transitif', topic: 'Normalisasi', level: 'Analisis', format: 'Pilihan Ganda', stem: 'Tabel Pegawai(id_pegawai, kode_dept, nama_dept) dengan kunci id_pegawai. nama_dept bergantung pada kode_dept. Bentuk normal mana yang dilanggar?', options: ['1NF', '2NF', '3NF', 'BCNF saja, tetapi 3NF terpenuhi'], answer: 2, explanation: 'nama_dept bergantung secara transitif pada kunci melalui kode_dept, sehingga melanggar 3NF.'},
  {title: 'Uji CTT 04 – Hasil LEFT JOIN', topic: 'Join', level: 'Penerapan', format: 'Pilihan Ganda', stem: 'Mahasiswa LEFT JOIN KRS pada NIM. Apa yang terjadi pada mahasiswa yang belum mengisi KRS?', options: ['Tidak muncul pada hasil', 'Muncul dua kali', 'Menyebabkan kueri gagal', 'Muncul dengan kolom KRS bernilai NULL'], answer: 3, explanation: 'LEFT JOIN mempertahankan semua baris tabel kiri; kolom tabel kanan yang tidak cocok bernilai NULL.'},
  {title: 'Uji CTT 05 – COUNT dengan GROUP BY', topic: 'Agregasi', level: 'Penerapan', format: 'Pilihan Ganda', stem: 'Kueri mana yang menghitung jumlah mahasiswa per program studi?', options: ['SELECT prodi, COUNT(*) FROM mahasiswa GROUP BY prodi', 'SELECT COUNT(prodi) FROM mahasiswa', 'SELECT prodi FROM mahasiswa ORDER BY COUNT(*)', 'SELECT SUM(prodi) FROM mahasiswa GROUP BY nim'], answer: 0, explanation: 'GROUP BY prodi membentuk kelompok per prodi, lalu COUNT(*) menghitung baris tiap kelompok.'},
  {title: 'Uji CTT 06 – Dampak Indeks', topic: 'Indeks', level: 'Analisis', format: 'Pilihan Ganda', stem: 'Apa konsekuensi menambahkan banyak indeks pada tabel yang sering diubah?', options: ['Kueri SELECT selalu menjadi lambat', 'Data menjadi tidak konsisten', 'Operasi INSERT dan UPDATE menjadi lebih lambat', 'Kunci primer tidak lagi diperlukan'], answer: 2, explanation: 'Setiap perubahan data juga harus memperbarui seluruh indeks, sehingga operasi tulis melambat.'},
  {title: 'Uji CTT 07 – ON DELETE CASCADE', topic: 'Integritas referensial', level: 'Memahami', format: 'Pilihan Ganda', stem: 'Kunci asing KRS.nim memakai ON DELETE CASCADE. Apa yang terjadi saat satu mahasiswa dihapus?', options: ['Penghapusan ditolak', 'Baris KRS milik mahasiswa itu ikut terhapus', 'KRS.nim diubah menjadi NULL', 'Tidak ada pengaruh pada KRS'], answer: 1, explanation: 'CASCADE menyebarkan penghapusan ke baris anak yang merujuk baris induk.'},
  {title: 'Uji CTT 08 – Dirty Read', topic: 'Transaksi', level: 'Analisis', format: 'Pilihan Ganda', stem: 'Tingkat isolasi mana yang masih memungkinkan dirty read?', options: ['Serializable', 'Repeatable Read', 'Read Committed', 'Read Uncommitted'], answer: 3, explanation: 'Hanya Read Uncommitted yang mengizinkan membaca data yang belum di-commit.'},
  {title: 'Uji CTT 09 – Relasi Banyak ke Banyak', topic: 'ERD', level: 'Penerapan', format: 'Pilihan Ganda', stem: 'Mahasiswa dapat mengambil banyak mata kuliah dan satu mata kuliah diambil banyak mahasiswa. Bagaimana relasi ini diimplementasikan?', options: ['Dengan tabel penghubung berisi kunci kedua tabel', 'Dengan menambah kolom mata kuliah di tabel mahasiswa', 'Dengan menggabungkan kedua tabel menjadi satu', 'Dengan kunci primer gabungan di tabel mahasiswa'], answer: 0, explanation: 'Relasi M:N diwujudkan dengan tabel penghubung (mis. KRS) yang memuat kunci asing ke kedua tabel.'},
  {title: 'Uji CTT 10 – Kunci Asing NULL', topic: 'Integritas referensial', level: 'Memahami', format: 'Benar/Salah', stem: 'Kunci asing boleh bernilai NULL bila relasinya bersifat opsional.', options: ['Benar', 'Salah'], answer: 0, explanation: 'Kunci asing tanpa batasan NOT NULL boleh kosong untuk relasi opsional.'},
]

// Pola respons 40 peserta × 10 soal (urutan Uji CTT 01–10). "_" = kosong, "E" = di luar opsi.
// Dirancang agar muncul: soal baik, terlalu mudah, sangat sukar, kunci perlu dicek, banyak kosong, daya pembeda perlu perbaikan, pengecoh tidak dipilih.
const pattern = ['ABCDACADAA', 'ABBAACBDAA', 'ABAAACBDAB', 'ABDACCBBAB', 'ABAAACBDAA', 'ABBAADDDAA', 'ABBAACADAB', 'ABCAACBDAA', 'ABBDACDDCA', 'BBBAABBDAA',
  'ABDAACBDAB', 'CBBADDDDAA', 'ABCDDDBDAB', 'DBDAADBDAA', 'ABDDABDCAB', 'ABADABBDAB', 'ABDBBCBBAA', 'CBBBDCDDAB', 'DBDAAABCBB', 'ABADABADAB',
  'ABACBDBAAA', 'ABDBACBAAA', 'ABAADCBBCA', 'BAADACBCCA', 'DBBCCDBDBB', 'ABDDAADBAA', 'ABDDDCCACB', 'BBDBCCBDBA', 'CBDADDBDAA', 'DBBBDBCBBB',
  'CBACCBBCAA', 'BBBDCAADBA', 'ABCDCCCABB', 'DBDBCABCCB', 'DBBDD_BDCA', 'DBDCB_DBAB', 'BBDBE_DAAB', 'BBBCC_DABB', 'CBBBA_BCCB', 'DBADA_DBBB']

try {
  const workspace = await openWorkspace(pool)
  const {questions, packages} = await workspace.list()
  let items = soal.map((item) => questions.find((question) => question.title === item.title && question.course === course))

  if (items.every(Boolean)) {
    console.log('Soal uji sudah ada; dipakai ulang.')
  } else {
    items = []
    for (const item of soal) {
      const id = `BS-${randomUUID().toUpperCase()}`
      const saved = await workspace.saveQuestion(id, {...item, course, status: 'review', changeNote: 'Soal uji coba analisis CTT'}, false, account)
      items.push(await workspace.decide(id, {revision: saved.revision, status: 'approved', note: 'Disetujui untuk uji coba analisis CTT'}, account))
    }
    console.log(`${items.length} soal uji dibuat dan disetujui.`)
  }
  if (items.some((item) => item.status !== 'approved')) throw new Error('Sebagian soal uji tidak lagi berstatus Disetujui. Buat paket baru secara manual atau pakai database eksperimen yang bersih.')

  const name = 'UTS Basis Data – Uji CTT'
  let examPackage = packages.find((item) => item.name === name && item.items.length === items.length && item.items.every((entry, index) => entry.questionId === items[index].id && entry.version === items[index].version))
  if (examPackage) console.log('Paket uji sudah ada; dipakai ulang.')
  else {
    examPackage = await workspace.savePackage({id: `PK-${randomUUID().toUpperCase()}`, name, course, questionIds: items.map((item) => item.id)}, account)
    console.log(`Paket "${name}" dibuat.`)
  }

  const header = ['id_peserta', 'id_soal', 'versi_soal', 'respons']
  const rows = pattern.flatMap((line, person) => [...line].map((answer, index) => [`M${String(person + 1).padStart(3, '0')}`, items[index].id, String(items[index].version), answer === '_' ? '' : answer]))
  const valid = rows.map((row) => row[3] === 'E' ? [...row.slice(0, 3), ''] : row)
  const broken = [...rows, ['M001', 'BS-TIDAK-ADA', '1', 'A'], ['M002', items[0].id, String(items[0].version), 'B'], ['M003', items[1].id, '9', 'B']]

  const out = resolve(values.out)
  await mkdir(out, {recursive: true})
  await writeFile(resolve(out, 'respons-uji-ctt.csv'), serializeCsv([header, ...valid]))
  await writeFile(resolve(out, 'respons-uji-ctt-salah.csv'), serializeCsv([header, ...broken]))
  console.log(`CSV ditulis ke ${out}:`)
  console.log('  respons-uji-ctt.csv        40 peserta × 10 soal, siap diimpor')
  console.log('  respons-uji-ctt-salah.csv  berisi respons E, soal asing, jawaban ganda, dan versi salah untuk menguji validasi')
} finally {
  await pool.end().catch(() => {})
}
