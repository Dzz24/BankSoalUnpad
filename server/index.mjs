import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import express from 'express'
import { createApplication } from './application.mjs'

const options = parseArgs({options: {dev: {type: 'boolean'}, port: {type: 'string'}}}).values
const port = Number(options.port ?? process.env.BANK_SOAL_PORT ?? (options.dev ? 5173 : 4173))
const root = resolve(import.meta.dirname, '..')

if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error('Gunakan port TCP yang valid.')
if (!options.dev && !existsSync(resolve(root, 'dist/index.html'))) throw new Error('Jalankan npm run build terlebih dahulu.')

const {app, close} = await createApplication()
const http = createServer(app)

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

http.once('close', () => void close())
http.listen(port, '127.0.0.1', () => {
  console.log(`Bank Soal Unpad · http://127.0.0.1:${http.address().port}/`)
})
