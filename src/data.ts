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
