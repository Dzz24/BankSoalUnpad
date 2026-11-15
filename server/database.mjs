import { existsSync, readFileSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { Pool } from 'pg'

const envFile = new URL('../.env', import.meta.url)
if (existsSync(envFile)) loadEnvFile(envFile)

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')

export function createPool() {
  const hosted = process.env.VERCEL === '1' && process.env.VERCEL_ENV !== 'development'
  const connectionString = process.env.DATABASE_URL?.trim() || (hosted && process.env.POSTGRES_URL?.trim())
  if (!connectionString) {
    throw Object.assign(new Error('Atur DATABASE_URL di .env atau variabel lingkungan. Lihat .env.example.'), {code: 'DATABASE_URL_MISSING'})
  }

  if (hosted) {
    let url
    try {
      url = new URL(connectionString)
    } catch {
      throw Object.assign(new Error('DATABASE_URL harus berupa URL PostgreSQL.'), {code: 'DATABASE_URL_INVALID'})
    }
    if (!url.hostname || !['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw Object.assign(new Error('DATABASE_URL harus berupa URL PostgreSQL.'), {code: 'DATABASE_URL_INVALID'})
    }
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '[::1]' || /^127\./.test(hostname)) {
      throw Object.assign(new Error('Deployment Vercel memerlukan alamat PostgreSQL cloud.'), {code: 'DATABASE_URL_LOOPBACK'})
    }
  }

  const options = {connectionString, application_name: 'bank-soal-unpad', connectionTimeoutMillis: 5_000, max: hosted ? 2 : 10}
  const ca = process.env.DATABASE_CA_CERT?.trim()
  if (ca) {
    const url = new URL(connectionString)
    // pg gives TLS parameters in the URL precedence over the ssl object.
    for (const parameter of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) {
      url.searchParams.delete(parameter)
    }
    options.connectionString = url.toString()
    options.ssl = {ca, rejectUnauthorized: true}
  }

  const pool = new Pool(options)
  pool.on('error', (error) => console.error('Koneksi PostgreSQL terputus:', error.code ?? error.name))
  return pool
}

export async function transaction(pool, operation, readOnly = false) {
  const client = await pool.connect()
  let releaseError
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      releaseError = rollbackError
    }
    throw error
  } finally {
    client.release(releaseError)
  }
}

export async function prepareSchema(client) {
  await client.query('SELECT pg_advisory_xact_lock(931272, 1)')
  await client.query(schema)
}

export async function initializeDatabase(pool, source, populate, matchesExistingDemo) {
  return transaction(pool, async (client) => {
    await prepareSchema(client)
    const {rows: [marker]} = await client.query("SELECT value FROM bank_soal_metadata WHERE key = 'initialized_from'")
    if (marker) {
      if (source === 'demo' || source === marker.value) return false
      if (marker.value === 'demo' && matchesExistingDemo && await matchesExistingDemo(client)) {
        await client.query("UPDATE bank_soal_metadata SET value = $1 WHERE key = 'initialized_from'", [source])
        return 'matched'
      }
      throw new Error('Database tujuan sudah diinisialisasi. Pilih database kosong untuk migrasi agar data PostgreSQL tetap aman.')
    }

    const {rows: [result]} = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM questions
        UNION ALL SELECT 1 FROM exam_packages
        UNION ALL SELECT 1 FROM audit_entries
      ) AS has_data
    `)
    if (result.has_data) throw new Error('Database tujuan sudah berisi data. Pilih database kosong.')

    await populate(client)
    await client.query("INSERT INTO bank_soal_metadata (key, value) VALUES ('initialized_from', $1)", [source])
    return true
  })
}
