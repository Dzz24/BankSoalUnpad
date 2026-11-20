import express from 'express'
import { createAuth, requireSameOrigin } from './auth.mjs'
import { createPool } from './database.mjs'
import { draftExample } from './seed.mjs'
import { ApiError, inputObject } from './validation.mjs'
import { openWorkspace } from './workspace.mjs'

export async function createApplication({trustProxy = false} = {}) {
  const pool = createPool()
  const workspace = await openWorkspace(pool)
  const auth = createAuth(pool)
  const api = express.Router()
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', trustProxy)

  api.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  api.use(requireSameOrigin)
  api.use('/auth', auth.router)
  api.get('/health', async (_request, response) => {
    try {
      await workspace.health()
      response.json({status: 'ok', database: 'postgresql'})
    } catch {
      response.status(503).json({status: 'unavailable', message: 'PostgreSQL belum dapat dihubungi.'})
    }
  })
  api.use(auth.requireSession)
  // Impor respons memerlukan batas lebih besar (200 peserta × 100 soal, NFR-03); rute ini dipasang sebelum parser umum.
  api.post('/imports', express.json({limit: '8mb'}), async (request, response) => response.status(201).json(await workspace.analysis.createImport(request.body, response.locals.account)))
  api.use(express.json({limit: '128kb'}))
  api.get('/imports', async (_request, response) => response.json(await workspace.analysis.listImports()))
  api.post('/imports/:id/analysis', async (request, response) => response.status(201).json(await workspace.analysis.runAnalysis(request.params.id, request.body, response.locals.account)))
  api.get('/analysis', async (_request, response) => response.json(await workspace.analysis.overview()))
  api.post('/analysis/:runId/questions/:questionId/decision', async (request, response) =>
    response.json(await workspace.analysis.decide(request.params.runId, request.params.questionId, request.body, response.locals.account)))
  api.get('/workspace', async (_request, response) => response.json(await workspace.list()))
  api.get('/questions/example', (_request, response) => response.json(draftExample))
  api.post('/questions', async (request, response) => {
    const body = inputObject(request.body)
    response.status(201).json(await workspace.saveQuestion(body.id, body, false, response.locals.account))
  })
  api.put('/questions/:id', async (request, response) => response.json(await workspace.saveQuestion(request.params.id, request.body, true, response.locals.account)))
  api.post('/questions/:id/review', async (request, response) => response.json(await workspace.decide(request.params.id, request.body, response.locals.account)))
  api.get('/questions/:id/history', async (request, response) => response.json(await workspace.history(request.params.id)))
  api.post('/packages', async (request, response) => response.status(201).json(await workspace.savePackage(request.body, response.locals.account)))
  api.get('/audit', async (_request, response) => response.json(await workspace.audit()))
  api.post('/reports/questions', async (request, response) => {
    const csv = await workspace.exportReport(request.body, response.locals.account)
    response.attachment('laporan-bank-soal.csv').type('text/csv; charset=utf-8').send(csv)
  })
  api.use((_request, response) => response.status(404).json({message: 'Endpoint API tidak ditemukan.'}))
  api.use((error, _request, response, _next) => {
    if (error instanceof ApiError) return response.status(error.status).json({message: error.message, ...(error.errors ? {errors: error.errors, errorCount: error.errorCount} : {})})
    if (error.type === 'entity.parse.failed') return response.status(400).json({message: 'Format JSON tidak valid.'})
    if (error.status === 413) return response.status(413).json({message: 'Ukuran permintaan terlalu besar.'})
    console.error(error)
    response.status(500).json({message: 'Server gagal memproses permintaan.'})
  })
  app.use('/api', api)
  return {app, close: workspace.close}
}
