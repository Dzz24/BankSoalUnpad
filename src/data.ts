export const courses = ['Basis Data', 'Struktur Data', 'Algoritma', 'Jaringan Komputer', 'Sistem Operasi', 'Keamanan TI', 'Kecerdasan Buatan'] as const
export const levels = ['Mengingat', 'Memahami', 'Penerapan', 'Analisis'] as const
export const formats = ['Pilihan Ganda', 'Benar/Salah'] as const

export type Course = (typeof courses)[number]
export type Format = (typeof formats)[number]
export type Level = (typeof levels)[number]
export type Status = 'draft' | 'review' | 'approved' | 'revision' | 'rejected'
export type Tone = 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'gray'

export type Question = {
  id: string
  version: number
  revision: number
  title: string
  course: Course
  topic: string
  level: Level
  format: Format
  stem: string
  options: string[]
  answer: number
  explanation: string
  status: Status
  owner: string
  faculty: string
  program: string
  updated: string
  priority: 'Tinggi' | 'Normal'
  reviewNote?: string
}

export const statusInfo: Record<Status, {label: string; tone: Tone}> = {
  approved: {label: 'Disetujui', tone: 'green'},
  review: {label: 'Menunggu Review', tone: 'amber'},
  revision: {label: 'Perlu Revisi', tone: 'red'},
  draft: {label: 'Draf', tone: 'purple'},
  rejected: {label: 'Ditolak', tone: 'gray'},
}

type Sample = Pick<Question, 'id' | 'title' | 'course' | 'status' | 'owner' | 'stem' | 'options' | 'answer' | 'explanation'>

const samples: Sample[] = [
  {id: 'BS-240', title: 'Implementasi Stack dan Queue', course: 'Struktur Data', status: 'approved', owner: 'D. Pratama', stem: 'Struktur data mana yang tepat untuk fitur undo pada editor teks?', options: ['Stack', 'Queue', 'Set', 'Hash map'], answer: 0, explanation: 'Stack mengambil tindakan terakhir terlebih dahulu (LIFO).'},
  {id: 'BS-241', title: 'Konsep Normalisasi Database', course: 'Basis Data', status: 'review', owner: 'N. Salsabila', stem: 'Tabel KRS memakai kunci gabungan (NIM, kode_mk). Nama mahasiswa hanya bergantung pada NIM. Perubahan mana yang menghilangkan ketergantungan parsial tersebut?', options: ['Pindahkan nama ke tabel Mahasiswa dengan NIM sebagai kunci.', 'Pindahkan nama ke tabel Mata Kuliah.', 'Tambahkan nama ke kunci gabungan.', 'Ganti kunci KRS dengan NIM saja.'], answer: 0, explanation: 'Nama bergantung pada NIM. Memindahkan nama ke tabel Mahasiswa menghilangkan ketergantungan parsial dari KRS.'},
  {id: 'BS-242', title: 'Routing Dinamis OSPF', course: 'Jaringan Komputer', status: 'revision', owner: 'A. Firmansyah', stem: 'OSPF menggunakan informasi keadaan tautan (link state) untuk menghitung rute.', options: ['Benar', 'Salah'], answer: 0, explanation: 'OSPF adalah protokol link-state.'},
  {id: 'BS-243', title: 'Analisis Kompleksitas Algoritma', course: 'Algoritma', status: 'approved', owner: 'D. Pratama', stem: 'Berapa kompleksitas waktu pencarian biner pada larik terurut?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], answer: 1, explanation: 'Ruang pencarian dibagi dua pada setiap iterasi.'},
  {id: 'BS-244', title: 'Konsep Virtual Memory', course: 'Sistem Operasi', status: 'draft', owner: 'R. Kurniawan', stem: 'Apa yang terjadi saat sebuah program mengakses halaman yang sedang tidak berada di memori fisik?', options: ['Page fault', 'Context switch', 'Deadlock', 'Cache hit'], answer: 0, explanation: 'Akses pada halaman yang tidak berada di RAM dapat memicu page fault.'},
  {id: 'BS-245', title: 'Keamanan Jaringan Dasar', course: 'Keamanan TI', status: 'approved', owner: 'N. Salsabila', stem: 'Mekanisme apa yang memeriksa integritas dan autentikasi pesan dengan kunci bersama?', options: ['HMAC', 'DNS', 'DHCP', 'Kompresi'], answer: 0, explanation: 'HMAC menghitung kode autentikasi pesan menggunakan fungsi hash dan kunci bersama.'},
  {id: 'BS-246', title: 'Model Relasional', course: 'Basis Data', status: 'review', owner: 'A. Firmansyah', stem: 'Kolom mana yang dapat menghubungkan tabel KRS dengan baris mahasiswa yang sesuai?', options: ['Kode ruang', 'NIM sebagai foreign key', 'Nama mata kuliah', 'Bobot SKS'], answer: 1, explanation: 'Foreign key NIM dapat merujuk ke primary key pada tabel Mahasiswa.'},
  {id: 'BS-247', title: 'Pengantar Kecerdasan Buatan', course: 'Kecerdasan Buatan', status: 'review', owner: 'R. Kurniawan', stem: 'Pendekatan mana yang menggunakan data pelatihan berlabel?', options: ['Pembelajaran terawasi', 'Pengelompokan', 'Reduksi dimensi tanpa label', 'Pencarian buta'], answer: 0, explanation: 'Pembelajaran terawasi melatih model dari contoh dengan label target.'},
  {id: 'BS-248', title: 'Struktur Data: Tree Traversal', course: 'Struktur Data', status: 'review', owner: 'D. Pratama', stem: 'Traversal mana yang mengunjungi simpul pohon lapis demi lapis?', options: ['Preorder', 'Inorder', 'Postorder', 'Breadth-first'], answer: 3, explanation: 'Breadth-first traversal mengunjungi semua simpul pada kedalaman yang sama sebelum turun.'},
  {id: 'BS-249', title: 'Penjadwalan Proses', course: 'Sistem Operasi', status: 'approved', owner: 'R. Kurniawan', stem: 'Algoritma mana yang memberikan kuantum waktu secara bergiliran?', options: ['First Come First Served', 'Round Robin', 'Shortest Job First', 'Priority tanpa preemption'], answer: 1, explanation: 'Round Robin menjadwalkan proses secara bergiliran dengan kuantum waktu.'},
  {id: 'BS-250', title: 'Konsep Subnet IPv4', course: 'Jaringan Komputer', status: 'revision', owner: 'A. Firmansyah', stem: 'Berapa total alamat IPv4 dalam blok /28?', options: ['8', '14', '16', '32'], answer: 2, explanation: 'Empat bit alamat tersisa menghasilkan 2⁴ atau 16 alamat termasuk network dan broadcast.'},
  {id: 'BS-251', title: 'Transaksi Basis Data', course: 'Basis Data', status: 'approved', owner: 'N. Salsabila', stem: 'Sifat ACID mana yang memastikan seluruh transaksi berhasil atau seluruhnya dibatalkan?', options: ['Consistency', 'Atomicity', 'Isolation', 'Durability'], answer: 1, explanation: 'Atomicity menjaga transaksi tetap utuh sebagai satu kesatuan.'},
]

export const seedQuestions: Question[] = samples.map((item, index) => ({
  ...item,
  version: 1,
  revision: 1,
  topic: item.title,
  level: index % 2 ? 'Penerapan' : 'Memahami',
  format: item.options.length === 2 ? 'Benar/Salah' : 'Pilihan Ganda',
  faculty: 'FMIPA',
  program: 'Informatika',
  updated: `2026-10-${23 - index}T09:00:00+07:00`,
  priority: index % 3 === 1 ? 'Tinggi' : 'Normal',
  reviewNote: item.status === 'revision' ? 'Periksa kejelasan redaksi dan pembahasan sebelum mengajukan ulang.' : undefined,
}))

export type QuestionFields = Pick<Question, 'title' | 'course' | 'topic' | 'level' | 'format' | 'stem' | 'options' | 'answer' | 'explanation'>
export type QuestionInput = QuestionFields & {status: 'draft' | 'review'; changeNote: string}
export type ReviewStatus = 'approved' | 'revision' | 'rejected'
export type QuestionVersion = {version: number; actor: string; created: string; note: string; snapshot: Question}
export type ReviewEntry = {version: number; actor: string; created: string; status: ReviewStatus; note: string}
export type QuestionUsage = {id: string; name: string; version: number; created: string}
export type QuestionHistory = {versions: QuestionVersion[]; reviews: ReviewEntry[]; usage: QuestionUsage[]}

export type PackageInput = { id: string; name: string; course: Course; questionIds: string[] }
export type PackageItem = {questionId: string; version: number; title: string; topic: string; level: Level}
export type ExamPackage = Pick<PackageInput, 'id' | 'name' | 'course'> & {items: PackageItem[]; created: string}
export type ExamImport = { id: string; name: string; rows: number; created: string }
export type Profile = { name: string; faculty: string }

export const seedPackages: Array<PackageInput & {created: string}> = [
  {id: 'PK-001', name: 'UTS Basis Data', course: 'Basis Data', questionIds: ['BS-251'], created: '2026-10-20T09:00:00'},
]

export const seedImports: ExamImport[] = [
  {id: 'IMP-001', name: 'respons-uts-basis-data.csv', rows: 120, created: '2026-10-20T09:00:00'},
]

export const qualityRows = [
  {id: 'BS-251', course: 'Basis Data', title: 'Transaksi Basis Data', difficulty: 0.67, discrimination: 0.41, effective: 3, options: 3},
  {id: 'BS-240', course: 'Struktur Data', title: 'Implementasi Stack dan Queue', difficulty: 0.83, discrimination: 0.37, effective: 2, options: 3},
  {id: 'BS-243', course: 'Algoritma', title: 'Analisis Kompleksitas Algoritma', difficulty: 0.34, discrimination: 0.23, effective: 2, options: 3},
  {id: 'BS-245', course: 'Keamanan TI', title: 'Keamanan Jaringan Dasar', difficulty: 0.73, discrimination: 0.52, effective: 3, options: 3},
  {id: 'BS-249', course: 'Sistem Operasi', title: 'Penjadwalan Proses', difficulty: 0.52, discrimination: 0.30, effective: 3, options: 3},
] satisfies Array<{id: string; course: Course; title: string; difficulty: number; discrimination: number; effective: number; options: number}>

const dateFormat = new Intl.DateTimeFormat('id-ID', {dateStyle: 'medium', timeZone: 'Asia/Jakarta'})
export const formatDate = (value: string) => dateFormat.format(new Date(value))
export const formatNumber = new Intl.NumberFormat('id-ID').format
export const formatDecimal = new Intl.NumberFormat('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format

export const auditLabels = {
  'question.created': 'Soal dibuat',
  'question.updated': 'Soal diperbarui',
  'review.submitted': 'Diajukan untuk review',
  'review.approved': 'Soal disetujui',
  'review.revision_requested': 'Revisi diminta',
  'review.rejected': 'Soal ditolak',
  'package.created': 'Paket dibuat',
  'report.exported': 'Laporan dibuat',
} as const

export type AuditAction = keyof typeof auditLabels
export type AuditEntry = {id: number; action: AuditAction; entityId: string; title: string; version: number | null; actor: string; created: string}

export function serializeCsv(rows: Array<Array<string | number>>) {
  return '\uFEFF' + rows.map((row) => row.map((value) => {
    const text = String(value)
    const safeText = typeof value === 'string' && /^[=+\-@\t\r\n]/.test(text.trimStart()) ? "'" + text : text
    return '"' + safeText.replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
}

export function downloadFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  downloadFile(filename, new Blob([serializeCsv(rows)], {type: 'text/csv;charset=utf-8;'}))
}
