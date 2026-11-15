import { existsSync, readFileSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { Pool } from 'pg'

const envFile = new URL('../.env', import.meta.url)
if (existsSync(envFile)) loadEnvFile(envFile)

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')

export function createPool() {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) throw new Error('Atur DATABASE_URL di .env atau variabel lingkungan. Lihat .env.example.')

  const pool = new Pool({connectionString, application_name: 'bank-soal-unpad', connectionTimeoutMillis: 5_000})
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
