import { finished } from 'node:stream/promises'
import { createApplication } from '../server/application.mjs'

let application

function getApplication() {
  application ??= createApplication({trustProxy: 1}).catch((error) => {
    application = undefined
    throw error
  })
  return application
}

export default async function handler(request, response) {
  let app
  try {
    ({app} = await getApplication())
  } catch (error) {
    console.error('Inisialisasi API Bank Soal gagal:', error.code ?? error.name)
    response.statusCode = 503
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.end(JSON.stringify({
      status: 'unavailable',
      message: 'Database belum tersedia. Periksa konfigurasi PostgreSQL pada deployment.',
    }))
    return
  }

  const url = new URL(request.url, 'http://bank-soal.internal')
  const route = url.searchParams.get('__bank_soal_path')
  if (route !== null && ['/api/handler', '/api/handler.js'].includes(url.pathname)) {
    url.pathname = '/api/' + route
  }
  url.searchParams.delete('__bank_soal_path')
  request.url = url.pathname + url.search

  const completion = finished(response, {cleanup: true})
  app(request, response)
  await completion
}
