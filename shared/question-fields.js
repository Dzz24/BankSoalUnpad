export const courses = /** @type {const} */ (['Basis Data', 'Struktur Data', 'Algoritma', 'Jaringan Komputer', 'Sistem Operasi', 'Keamanan TI', 'Kecerdasan Buatan'])
export const levels = /** @type {const} */ (['Mengingat', 'Memahami', 'Penerapan', 'Analisis'])
export const formats = /** @type {const} */ (['Pilihan Ganda', 'Benar/Salah'])

export const statusInfo = /** @type {const} */ ({
  approved: {label: 'Disetujui', tone: 'green'},
  review: {label: 'Menunggu Review', tone: 'amber'},
  revision: {label: 'Perlu Revisi', tone: 'red'},
  draft: {label: 'Draf', tone: 'purple'},
  rejected: {label: 'Ditolak', tone: 'gray'},
})
