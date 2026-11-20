import { serializeCsv } from '../shared/csv.js'
import { courses, formats, levels, statusInfo } from '../shared/question-fields.js'

export { courses, formats, levels, statusInfo }

export type Course = (typeof courses)[number]
export type Format = (typeof formats)[number]
export type Level = (typeof levels)[number]
export type Status = keyof typeof statusInfo
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
  /** Ringkasan analisis terbaru dari server; tidak disimpan di data soal. */
  analysis?: QuestionAnalysis
  /** Konteks analisis yang memicu revisi atau pensiun soal. */
  analysisContext?: AnalysisContext
}

export type Priority = 'high' | 'medium' | 'low'
export type FollowUpDecision = 'keep' | 'revise' | 'retire'
export type QuestionAnalysis = {version: number; analyzed: boolean; priority: Priority | null; runId: string; created: string; decision: FollowUpDecision | null}
export type AnalysisContext = {runId: string; source: string; version: number; priority: Priority | null; reasons: string[]; difficulty: number | null; discrimination: number | null; decision: FollowUpDecision; reason: string; actor: string; created: string}

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
export type AnalysisSummary = {
  participantCount: number; averageDifficulty: number | null; averageDiscrimination: number | null; effectiveDistractorShare: number | null
  reliability: {kr20: number | null; note: string | null}; followUp: Record<Priority, number>
}
export type ExamImport = {
  id: string; packageId: string; packageName: string; course: Course; period: string; fileName: string
  participantCount: number; rowCount: number; actor: string; created: string; runId: string | null; analyzedAt: string | null; summary: AnalysisSummary | null
}
export type ImportInput = {id: string; packageId: string; period: string; fileName: string; rows: Array<Record<string, string>>}
export type Profile = { name: string; faculty: string }

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
  'import.created': 'Hasil ujian diimpor',
  'analysis.completed': 'Analisis CTT dijalankan',
  'analysis.kept': 'Soal dipertahankan dari analisis',
  'analysis.revision_requested': 'Revisi diminta dari analisis',
  'question.retired': 'Soal dipensiunkan',
} as const

export type AuditAction = keyof typeof auditLabels
export type AuditEntry = {id: number; action: AuditAction; entityId: string; title: string; version: number | null; actor: string; created: string}

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
