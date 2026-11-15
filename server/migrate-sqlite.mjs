import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { isDeepStrictEqual } from 'node:util'
import { createPool, initializeDatabase } from './database.mjs'

const source = process.argv[2] ? resolve(process.argv[2]) : resolve(import.meta.dirname, '../storage/bank-soal.sqlite')

function readSnapshot(filename) {
  const db = new DatabaseSync(filename, {readOnly: true, timeout: 5_000})
  try {
    db.exec('BEGIN')
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') {
      throw new Error('Pemeriksaan integritas SQLite gagal.')
    }
    if (db.prepare('PRAGMA user_version').get().user_version !== 1) {
      throw new Error('Versi database SQLite ini tidak didukung.')
    }
    if (db.prepare('PRAGMA foreign_key_check').get()) throw new Error('Ada referensi yang tidak valid di SQLite.')
    return {
      questions: db.prepare('SELECT id, data FROM questions ORDER BY id').all(),
      versions: db.prepare('SELECT * FROM question_versions ORDER BY question_id, version').all(),
      packages: db.prepare('SELECT * FROM exam_packages ORDER BY id').all(),
      items: db.prepare('SELECT * FROM package_items ORDER BY package_id, position, question_id').all(),
      audit: db.prepare('SELECT * FROM audit_entries ORDER BY id').all(),
    }
  } finally {
    db.close()
  }
}

function legacyTimestamp(value) {
  // SQLite demo timestamps without an offset were entered in campus local time.
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + '+07:00'
}

function isoTimestamp(value) {
  return new Date(typeof value === 'string' ? legacyTimestamp(value) : value).toISOString()
}

function normalizeQuestion(data) {
  const fields = typeof data === 'string' ? JSON.parse(data) : data
  return {...fields, updated: isoTimestamp(fields.updated)}
}

function normalizeSnapshot({questions, versions, packages, items, audit}) {
  const withTimestamp = (row) => ({...row, created: isoTimestamp(row.created)})
  return {
    questions: questions.map(({id, data}) => ({id, data: normalizeQuestion(data)})),
    versions: versions.map((row) => ({...withTimestamp(row), snapshot: normalizeQuestion(row.snapshot)})),
    packages: packages.map(withTimestamp),
    items: items.map((row) => ({...row})),
    audit: audit.map(withTimestamp),
  }
}

async function matchesSnapshot(client, sourceSnapshot) {
  const {rows: questions} = await client.query('SELECT id, data FROM questions ORDER BY id COLLATE "C"')
  const {rows: versions} = await client.query('SELECT * FROM question_versions ORDER BY question_id COLLATE "C", version')
  const {rows: packages} = await client.query('SELECT * FROM exam_packages ORDER BY id COLLATE "C"')
  const {rows: items} = await client.query('SELECT * FROM package_items ORDER BY package_id COLLATE "C", position, question_id COLLATE "C"')
  const {rows: audit} = await client.query('SELECT * FROM audit_entries ORDER BY id')
  return isDeepStrictEqual(normalizeSnapshot({questions, versions, packages, items, audit}), sourceSnapshot)
}

async function migrate() {
  const snapshot = normalizeSnapshot(readSnapshot(source))
  const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
  const pool = createPool()
  try {
    const migrated = await initializeDatabase(pool, `sqlite:${hash}`, async (client) => {
      for (const {id, data} of snapshot.questions) {
        await client.query('INSERT INTO questions (id, data, updated) VALUES ($1, $2, $3)', [id, data, data.updated])
      }
      for (const version of snapshot.versions) {
        await client.query(
          'INSERT INTO question_versions (question_id, version, created, actor, note, snapshot) VALUES ($1, $2, $3, $4, $5, $6)',
          [version.question_id, version.version, version.created, version.actor, version.note, version.snapshot],
        )
      }
      for (const item of snapshot.packages) {
        await client.query('INSERT INTO exam_packages (id, name, course, created) VALUES ($1, $2, $3, $4)',
          [item.id, item.name, item.course, item.created])
      }
      for (const item of snapshot.items) {
        await client.query('INSERT INTO package_items (package_id, question_id, version, position) VALUES ($1, $2, $3, $4)',
          [item.package_id, item.question_id, item.version, item.position])
      }
      for (const entry of snapshot.audit) {
        await client.query(
          'INSERT INTO audit_entries (id, action, entity_id, title, version, actor, created, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [entry.id, entry.action, entry.entity_id, entry.title, entry.version, entry.actor, entry.created, entry.note],
        )
      }
      await client.query("SELECT setval(pg_get_serial_sequence('audit_entries', 'id'), COALESCE(MAX(id), 1), COUNT(*) > 0) FROM audit_entries")
    }, (client) => matchesSnapshot(client, snapshot))
    if (migrated) {
      const result = migrated === 'matched' ? 'Data PostgreSQL sudah identik dengan snapshot SQLite' : 'Migrasi selesai'
      console.log(`${result}: ${snapshot.questions.length} soal, ${snapshot.versions.length} versi, ${snapshot.packages.length} paket, ${snapshot.items.length} relasi paket, ${snapshot.audit.length} log.`)
    } else {
      console.log('Snapshot SQLite ini sudah dimigrasikan.')
    }
  } finally {
    await pool.end()
  }
}

migrate().catch((error) => {
  console.error('Migrasi gagal:', error.message)
  process.exitCode = 1
})
