export const courses = /** @type {const} */ (['Basis Data', 'Struktur Data', 'Algoritma', 'Jaringan Komputer', 'Sistem Operasi', 'Keamanan TI', 'Kecerdasan Buatan'])
export const levels = /** @type {const} */ (['Mengingat', 'Memahami', 'Penerapan', 'Analisis', 'Mengevaluasi', 'Mencipta'])
export const cognitiveLevels = /** @type {const} */ ([
  {id: 'C1', value: 'mengingat', label: 'Mengingat', description: 'Mengingat fakta, istilah, atau definisi.'},
  {id: 'C2', value: 'memahami', label: 'Memahami', description: 'Menjelaskan konsep dan menafsirkan informasi.'},
  {id: 'C3', value: 'penerapan', label: 'Penerapan', description: 'Menerapkan aturan atau konsep pada kasus.'},
  {id: 'C4', value: 'analisis', label: 'Analisis', description: 'Menganalisis hubungan, struktur, atau penyebab.'},
  {id: 'C5', value: 'evaluasi', label: 'Mengevaluasi', description: 'Menilai solusi menggunakan kriteria yang jelas.'},
  {id: 'C6', value: 'mencipta', label: 'Mencipta', description: 'Menentukan rancangan solusi berdasarkan tujuan dan batasan.'},
])
export const formats = /** @type {const} */ (['Pilihan Ganda', 'Benar/Salah'])

export const statusInfo = /** @type {const} */ ({
  approved: {label: 'Disetujui', tone: 'green'},
  review: {label: 'Menunggu Review', tone: 'amber'},
  revision: {label: 'Perlu Revisi', tone: 'red'},
  draft: {label: 'Draf', tone: 'purple'},
  rejected: {label: 'Ditolak', tone: 'gray'},
  retired: {label: 'Dipensiunkan', tone: 'gray'},
})
