// Membuat paket uji besar: 100 soal Basis Data (90 pilihan ganda + 10 Benar/Salah) dan respons 200 peserta.
// Ukurannya sama dengan batas NFR-03 (200 peserta × 100 soal). Khusus database eksperimen.
// Pemakaian (PowerShell, dengan $env:DATABASE_URL mengarah ke bank_soal_exp):
//   node scripts/seed-uji-ctt-besar.mjs
// Opsi: --soal <n> (bawaan 100, maks 200), --peserta <n> (bawaan 200), --out <folder>, --actor <nama_pengguna>, --force
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { serializeCsv } from '../shared/csv.js'
import { createPool } from '../server/database.mjs'
import { openWorkspace } from '../server/workspace.mjs'

const {values} = parseArgs({options: {
  soal: {type: 'string', default: '100'}, peserta: {type: 'string', default: '200'},
  out: {type: 'string', default: 'storage/uji-ctt-besar'}, actor: {type: 'string', default: 'rizki'}, force: {type: 'boolean', default: false},
}})
const itemCount = Number(values.soal)
const personCount = Number(values.peserta)
if (!Number.isInteger(itemCount) || itemCount < 10 || itemCount > 200) throw new Error('--soal harus 10 sampai 200.')
if (!Number.isInteger(personCount) || personCount < 10 || personCount > 1000) throw new Error('--peserta harus 10 sampai 1000.')

const pool = createPool()
const database = new URL(process.env.DATABASE_URL ?? 'postgresql://x/x').pathname.slice(1)
if (!database.endsWith('_exp') && !values.force) {
  console.error(`Database "${database}" bukan database eksperimen (*_exp). Skrip dihentikan. Pakai --force bila memang disengaja.`)
  await pool.end().catch(() => {})
  process.exit(1)
}

// Bahan soal Basis Data. Setiap bahan dipakai beberapa kali sebagai varian dengan urutan opsi diputar, sehingga kunci berbeda-beda.
const multipleChoice = [
  ['Kunci relasi', 'Memahami', 'Apa fungsi utama kunci primer pada tabel relasional?', ['Mengidentifikasi setiap baris secara unik', 'Mempercepat semua jenis kueri', 'Menghubungkan tabel ke basis data lain', 'Menyimpan nilai bawaan kolom']],
  ['SQL dasar', 'Mengingat', 'Perintah SQL mana yang menampilkan seluruh kolom tabel mahasiswa?', ['SELECT * FROM mahasiswa', 'SHOW mahasiswa', 'GET ALL mahasiswa', 'SELECT mahasiswa.*ALL']],
  ['Normalisasi', 'Analisis', 'nama_dept bergantung pada kode_dept, sedangkan kunci tabel adalah id_pegawai. Bentuk normal mana yang dilanggar?', ['3NF', '1NF', '2NF', 'BCNF saja']],
  ['Join', 'Penerapan', 'Mahasiswa LEFT JOIN KRS. Apa yang terjadi pada mahasiswa tanpa KRS?', ['Muncul dengan kolom KRS bernilai NULL', 'Tidak muncul pada hasil', 'Muncul dua kali', 'Kueri gagal']],
  ['Agregasi', 'Penerapan', 'Kueri mana yang menghitung jumlah mahasiswa per program studi?', ['SELECT prodi, COUNT(*) FROM mahasiswa GROUP BY prodi', 'SELECT COUNT(prodi) FROM mahasiswa', 'SELECT prodi FROM mahasiswa ORDER BY COUNT(*)', 'SELECT SUM(prodi) FROM mahasiswa GROUP BY nim']],
  ['Indeks', 'Analisis', 'Apa konsekuensi menambahkan banyak indeks pada tabel yang sering diubah?', ['INSERT dan UPDATE menjadi lebih lambat', 'SELECT selalu menjadi lambat', 'Data menjadi tidak konsisten', 'Kunci primer tidak diperlukan lagi']],
  ['Integritas referensial', 'Memahami', 'Kunci asing memakai ON DELETE CASCADE. Apa yang terjadi saat baris induk dihapus?', ['Baris anak yang merujuk ikut terhapus', 'Penghapusan ditolak', 'Kunci asing diubah menjadi NULL', 'Tidak ada pengaruh']],
  ['Transaksi', 'Analisis', 'Tingkat isolasi mana yang masih memungkinkan dirty read?', ['Read Uncommitted', 'Read Committed', 'Repeatable Read', 'Serializable']],
  ['ERD', 'Penerapan', 'Bagaimana relasi banyak ke banyak diimplementasikan pada model relasional?', ['Dengan tabel penghubung berisi kunci kedua tabel', 'Dengan menambah kolom di salah satu tabel', 'Dengan menggabungkan kedua tabel', 'Dengan kunci primer gabungan di tabel induk']],
  ['Transaksi', 'Memahami', 'Sifat ACID mana yang menjamin transaksi dijalankan seluruhnya atau tidak sama sekali?', ['Atomicity', 'Consistency', 'Isolation', 'Durability']],
  ['SQL dasar', 'Penerapan', 'Klausa mana yang menyaring hasil setelah pengelompokan?', ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT']],
  ['Normalisasi', 'Memahami', 'Tabel dikatakan 1NF bila…', ['Setiap kolom bernilai atomik', 'Tidak ada ketergantungan transitif', 'Setiap determinan adalah kunci kandidat', 'Tidak ada kunci asing']],
  ['Kunci relasi', 'Memahami', 'Kunci kandidat yang tidak dipilih sebagai kunci primer disebut…', ['Kunci alternatif', 'Kunci asing', 'Kunci komposit', 'Kunci super minimal']],
  ['Join', 'Analisis', 'Join apa yang menghasilkan semua kombinasi baris dari dua tabel?', ['CROSS JOIN', 'INNER JOIN', 'LEFT JOIN', 'NATURAL JOIN']],
  ['Subkueri', 'Penerapan', 'Operator mana yang tepat untuk memeriksa keberadaan baris pada subkueri berkorelasi?', ['EXISTS', 'BETWEEN', 'LIKE', 'UNION']],
  ['View', 'Memahami', 'Apa itu view pada basis data relasional?', ['Tabel virtual hasil kueri tersimpan', 'Salinan fisik tabel', 'Indeks tambahan', 'Cadangan basis data']],
  ['Indeks', 'Penerapan', 'Kolom mana yang paling layak diberi indeks?', ['Kolom yang sering dipakai pada WHERE dan JOIN', 'Kolom yang jarang dibaca', 'Kolom bertipe teks panjang yang jarang dicari', 'Kolom yang selalu bernilai sama']],
  ['Keamanan', 'Memahami', 'Perintah SQL untuk memberi hak akses kepada pengguna adalah…', ['GRANT', 'REVOKE', 'ALLOW', 'PERMIT']],
]
const trueFalse = [
  ['Integritas referensial', 'Memahami', 'Kunci asing boleh bernilai NULL bila relasinya opsional.', 0],
  ['Kunci relasi', 'Mengingat', 'Satu tabel boleh memiliki lebih dari satu kunci primer.', 1],
  ['Transaksi', 'Memahami', 'ROLLBACK membatalkan perubahan transaksi yang belum di-commit.', 0],
  ['SQL dasar', 'Mengingat', 'Klausa WHERE dapat memuat fungsi agregat seperti COUNT secara langsung.', 1],
  ['Normalisasi', 'Memahami', 'Normalisasi bertujuan mengurangi redundansi data.', 0],
]

// Profil butir untuk simulasi: kesukaran b, daya beda a, dan kasus khusus yang ingin terlihat di hasil analisis.
const profiles = ['baik', 'baik', 'mudah', 'baik', 'kunci-keliru', 'sukar', 'lemah', 'baik', 'pengecoh-mati', 'baik']
const profileFor = (index) => index >= itemCount - 8 ? 'kosong-akhir' : (index + 1) % 10 === 0 ? 'baik' : profiles[index % profiles.length]

function buildItems() {
  const items = []
  let mc = 0
  let tf = 0
  for (let index = 0; index < itemCount; index += 1) {
    const number = String(index + 1).padStart(3, '0')
    if ((index + 1) % 10 === 0) {
      const [topic, level, stem, answer] = trueFalse[tf % trueFalse.length]
      const variant = Math.floor(tf / trueFalse.length) + 1
      tf += 1
      items.push({title: `Uji Besar ${number} – ${topic}`, topic, level, format: 'Benar/Salah', stem: variant > 1 ? `${stem} (varian ${variant})` : stem,
        options: ['Benar', 'Salah'], answer, explanation: 'Soal uji beban analisis CTT.'})
      continue
    }
    const [topic, level, stem, options] = multipleChoice[mc % multipleChoice.length]
    const variant = Math.floor(mc / multipleChoice.length)
    mc += 1
    const shift = (variant + mc) % 4
    const rotated = options.map((_, position) => options[(position + shift) % 4])
    items.push({title: `Uji Besar ${number} – ${topic}`, topic, level, format: 'Pilihan Ganda', stem: variant ? `${stem} (varian ${variant + 1})` : stem,
      options: rotated, answer: rotated.indexOf(options[0]), explanation: 'Soal uji beban analisis CTT.'})
  }
  return items
}

// Pembangkit acak dengan benih tetap agar file CSV selalu sama untuk soal yang sama.
let seed = 20261120
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const normal = () => Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random())

function simulate(items) {
  const abilities = Array.from({length: personCount}, normal)
  const parameters = items.map((item, index) => {
    const profile = profileFor(index)
    const b = {mudah: -2.6, sukar: 2.2}[profile] ?? (random() * 2.4 - 1.2)
    const a = profile === 'lemah' ? 0.15 : profile === 'kunci-keliru' ? 1.1 : 0.9 + random() * 0.8
    return {profile, a, b, guess: item.format === 'Benar/Salah' ? 0.5 : 0.2}
  })
  const rows = []
  abilities.forEach((theta, person) => {
    const id = `P${String(person + 1).padStart(4, '0')}`
    items.forEach((item, index) => {
      const {profile, a, b, guess} = parameters[index]
      const labels = item.options.map((_, position) => String.fromCharCode(65 + position))
      if (profile === 'kosong-akhir' && theta < -0.6 && random() < 0.55) return void rows.push([id, item.id, String(item.version), ''])
      // Pada butir "kunci-keliru", jawaban yang sebenarnya benar adalah opsi lain, bukan kunci yang tersimpan.
      const truth = profile === 'kunci-keliru' ? (item.answer + 1) % labels.length : item.answer
      const chance = guess + (1 - guess) / (1 + Math.exp(-1.7 * a * (theta - b)))
      let choice = truth
      if (random() >= chance) {
        const wrong = labels.map((_, position) => position).filter((position) => position !== truth && !(profile === 'pengecoh-mati' && position === (truth + 3) % 4))
        choice = wrong[Math.floor(random() * wrong.length)]
      }
      rows.push([id, item.id, String(item.version), labels[choice]])
    })
  })
  return rows
}

const account = {username: values.actor, name: 'M Rizky Khatami'}
const course = 'Basis Data'
const packageName = `UTS Basis Data – Uji ${itemCount} Soal`
try {
  const workspace = await openWorkspace(pool)
  const {questions, packages} = await workspace.list()
  const blueprint = buildItems()
  let items = blueprint.map((item) => questions.find((question) => question.title === item.title && question.course === course && question.status === 'approved'))
  if (items.every(Boolean)) console.log(`${items.length} soal uji sudah ada; dipakai ulang.`)
  else {
    items = []
    for (const [index, item] of blueprint.entries()) {
      const existing = questions.find((question) => question.title === item.title && question.course === course)
      if (existing?.status === 'approved') {
        items.push(existing)
        continue
      }
      const id = `BS-${randomUUID().toUpperCase()}`
      const saved = await workspace.saveQuestion(id, {...item, course, status: 'review', changeNote: 'Soal uji beban analisis CTT'}, false, account)
      items.push(await workspace.decide(id, {revision: saved.revision, status: 'approved', note: 'Disetujui untuk uji beban analisis CTT'}, account))
      if ((index + 1) % 25 === 0) console.log(`  ${index + 1} soal dibuat…`)
    }
    console.log(`${items.length} soal uji siap (Disetujui).`)
  }

  let examPackage = packages.find((item) => item.name === packageName && item.items.length === items.length && item.items.every((entry, index) => entry.questionId === items[index].id && entry.version === items[index].version))
  if (examPackage) console.log(`Paket "${packageName}" sudah ada; dipakai ulang.`)
  else {
    examPackage = await workspace.savePackage({id: `PK-${randomUUID().toUpperCase()}`, name: packageName, course, questionIds: items.map((item) => item.id)}, account)
    console.log(`Paket "${packageName}" dibuat.`)
  }

  const rows = simulate(items)
  const out = resolve(values.out)
  await mkdir(out, {recursive: true})
  const file = resolve(out, `respons-uji-${itemCount}-soal-${personCount}-peserta.csv`)
  await writeFile(file, serializeCsv([['id_peserta', 'id_soal', 'versi_soal', 'respons'], ...rows]))
  console.log(`CSV ditulis: ${file} (${rows.length.toLocaleString('id-ID')} baris)`)
  console.log('Profil butir yang disimulasikan: sebagian besar baik, ditambah soal sangat mudah, sangat sukar, daya beda lemah,')
  console.log('pengecoh yang tidak dipilih, kunci yang diduga keliru, dan 8 soal terakhir yang banyak dikosongkan peserta berkemampuan rendah.')
} finally {
  await pool.end().catch(() => {})
}
