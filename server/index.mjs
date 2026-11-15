import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import express from 'express'
import { ApiError, inputObject } from './validation.mjs'
import { openWorkspace } from './workspace.mjs'

const options = parseArgs({options: {dev: {type: 'boolean'}, port: {type: 'string'}}}).values
const port = Number(options.port ?? process.env.BANK_SOAL_PORT ?? (options.dev ? 5173 : 4173))
const root = resolve(import.meta.dirname, '..')
const app = express()
const http = createServer(app)

if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error('Gunakan port TCP yang valid.')
if (!options.dev && !existsSync(resolve(root, 'dist/index.html'))) throw new Error('Jalankan npm run build terlebih dahulu.')

const workspace = await openWorkspace()
const api = express.Router()
app.disable('x-powered-by')

api.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
})
api.use(express.json({limit: '128kb'}))
api.get('/health', async (_request, response) => {
  try {
    await workspace.health()
    response.json({status: 'ok', database: 'postgresql'})
  } catch {
    response.status(503).json({status: 'unavailable', message: 'PostgreSQL belum dapat dihubungi.'})
  }
})
api.get('/workspace', async (_request, response) => response.json(await workspace.list()))
api.post('/questions', async (request, response) => {
  const body = inputObject(request.body)
  response.status(201).json(await workspace.saveQuestion(body.id, body, false))
})
api.put('/questions/:id', async (request, response) => response.json(await workspace.saveQuestion(request.params.id, request.body, true)))
api.post('/questions/:id/review', async (request, response) => response.json(await workspace.decide(request.params.id, request.body)))
api.get('/questions/:id/history', async (request, response) => response.json(await workspace.history(request.params.id)))
api.post('/packages', async (request, response) => response.status(201).json(await workspace.savePackage(request.body)))
api.get('/audit', async (_request, response) => response.json(await workspace.audit()))
api.post('/reports/questions', async (request, response) => {
  const csv = await workspace.exportReport(request.body)
  response.attachment('laporan-bank-soal.csv').type('text/csv; charset=utf-8').send(csv)
})
api.use((_request, response) => response.status(404).json({message: 'Endpoint API tidak ditemukan.'}))
app.use('/api', api)

if (options.dev) {
  const { createServer: createVite } = await import('vite')
  const privateFiles = ['**/storage/**', '**/*.sqlite*', '**/server/**']
  const vite = await createVite({
    root,
    server: {
      middlewareMode: true,
      hmr: {server: http},
      watch: {ignored: privateFiles},
      fs: {deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', ...privateFiles]},
    },
    appType: 'spa',
  })
  app.use(vite.middlewares)
} else {
  app.use(express.static(resolve(root, 'dist')))
}

app.use((error, _request, response, _next) => {
  if (error instanceof ApiError) return response.status(error.status).json({message: error.message})
  if (error.type === 'entity.parse.failed') return response.status(400).json({message: 'Format JSON tidak valid.'})
  if (error.status === 413) return response.status(413).json({message: 'Ukuran permintaan terlalu besar.'})
  console.error(error)
  response.status(500).json({message: 'Server gagal memproses permintaan.'})
})

http.once('close', () => void workspace.close())
http.listen(port, '127.0.0.1', () => {
  console.log(`Bank Soal Unpad · http://127.0.0.1:${http.address().port}/`)
})
