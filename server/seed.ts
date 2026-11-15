import type { PackageInput, Question, QuestionFields } from '../src/data.ts'

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

export const seedPackages: Array<PackageInput & {created: string}> = [
  {id: 'PK-001', name: 'UTS Basis Data', course: 'Basis Data', questionIds: ['BS-251'], created: '2026-10-20T09:00:00'},
]

const {title, course, level, format, stem, options, answer, explanation} = seedQuestions[1]
export const draftExample: QuestionFields = {
  title, course, topic: 'Normalisasi basis data', level, format, stem, options, answer, explanation,
}
