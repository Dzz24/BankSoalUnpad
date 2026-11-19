import type { AuditEntry, ExamPackage, PackageInput, Question, QuestionFields, QuestionHistory, QuestionInput, ReviewStatus } from './data'
import { cognitiveLevels } from '../shared/question-fields.js'

export type GenerationInput = {
  mode?: 'material' | 'topic'
  material: string; topic: string; count: number; course: Question['course']
  cognitiveLevel: (typeof cognitiveLevels)[number]['value']
}
export type GeneratedQuestion = {
  stem: string; options: {id: string; text: string}[]; correctOptionId: string
  explanation: string; topic: string; cognitiveLevel: GenerationInput['cognitiveLevel']
  suggestedMetadata: {title: string; tags: string[]}
}

export type Workspace = {questions: Question[]; packages: ExamPackage[]}
export type AuthUser = {username: string; name: string}
export type Session = {user: AuthUser; expiresAt: string}
export const sessionEndedEvent = 'bank-soal:session-ended'

async function request(path: string, init?: RequestInit) {
  let response: Response
  try {
    response = await fetch('/api' + path, init)
  } catch (error) {
    if (init?.signal?.aborted) throw error
    throw new Error('Backend tidak dapat dihubungi. Periksa server dan coba lagi.')
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(sessionEndedEvent))
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || 'Backend gagal memproses permintaan.')
  }
  return response
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init)
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('API Bank Soal tidak tersedia. Jalankan aplikasi dengan npm run dev.')
  }
  return response.json()
}

function body(method: 'POST' | 'PUT', payload: object): RequestInit {
  return {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)}
}

export const getSession = (signal?: AbortSignal) => json<{session: Session | null}>('/auth/session', {signal})
export const logIn = (username: string, password: string) => json<{session: Session}>('/auth/login', body('POST', {username, password}))
export const logOut = () => request('/auth/logout', {method: 'POST'})
export const getWorkspace = (signal?: AbortSignal) => json<Workspace>('/workspace', {signal})
export const getDraftExample = () => json<QuestionFields>('/questions/example')
export const generateQuestions = (input: GenerationInput) =>
  json<{questions: GeneratedQuestion[]; drafts: Question[]}>('/questions/generate', body('POST', input))

export function saveQuestion(id: string, input: QuestionInput, revision?: number) {
  return revision === undefined
    ? json<Question>('/questions', body('POST', {...input, id}))
    : json<Question>(`/questions/${encodeURIComponent(id)}`, body('PUT', {...input, revision}))
}

export function reviewQuestion(id: string, revision: number, status: ReviewStatus, note: string) {
  return json<Question>(`/questions/${encodeURIComponent(id)}/review`, body('POST', {revision, status, note}))
}

export const getQuestionHistory = (id: string, signal?: AbortSignal) =>
  json<QuestionHistory>(`/questions/${encodeURIComponent(id)}/history`, {signal})

export const savePackage = (input: PackageInput) => json<ExamPackage>('/packages', body('POST', input))
export const getAudit = (signal?: AbortSignal) => json<AuditEntry[]>('/audit', {signal})

export async function exportQuestionReport(course: string) {
  const response = await request('/reports/questions', body('POST', {course}))
  if (!response.headers.get('content-type')?.includes('text/csv')) throw new Error('File laporan tidak dapat dibuat.')
  return response.blob()
}
