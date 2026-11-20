import { randomUUID } from 'node:crypto'
import { serializeCsv } from '../shared/csv.js'
import { courses, statusInfo } from '../shared/question-fields.js'
import { createAnalysis } from './analysis.mjs'
import { initializeDatabase, transaction } from './database.mjs'
import { seedPackages, seedQuestions } from './seed.mjs'
import { ApiError, checkRevision, choiceField, inputObject, questionInput, requestId, stringField } from './validation.mjs'

const editableStatuses = ['draft', 'revision']
const decisions = {approved: 'review.approved', revision: 'review.revision_requested', rejected: 'review.rejected'}
const decisionStatus = Object.fromEntries(Object.entries(decisions).map(([status, action]) => [action, status]))
const now = () => new Date().toISOString()
const sameFields = (question, fields) => Object.keys(fields).every((key) => JSON.stringify(fields[key]) === JSON.stringify(question[key]))

async function record(client, actor, action, {id, title, version = null, updated}, note = '') {
  await client.query(
    'INSERT INTO audit_entries (action, entity_id, title, version, actor, created, note) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [action, id, title, version, actor, updated, note],
  )
}

async function addVersion(client, question, note, author) {
  await client.query(
    'INSERT INTO question_versions (question_id, version, created, actor, note, snapshot) VALUES ($1, $2, $3, $4, $5, $6)',
    [question.id, question.version, question.updated, author, note, question],
  )
}

async function insertQuestion(client, question) {
  const {rowCount} = await client.query(
    'INSERT INTO questions (id, data, updated) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
    [question.id, question, question.updated],
  )
  return rowCount === 1
}

async function requireQuestion(client, id, lock = false) {
  const sql = 'SELECT data FROM questions WHERE id = $1'
  const {rows: [row]} = await client.query(lock ? sql + ' FOR UPDATE' : sql, [id])
  if (!row) throw new ApiError(404, 'Soal tidak ditemukan.')
  return row.data
}

async function listQuestions(client) {
  const {rows} = await client.query('SELECT data FROM questions ORDER BY updated DESC, id')
  return rows.map(({data}) => data)
}

// Ringkasan analisis terbaru per soal, untuk label "Sudah dianalisis" dan "Perlu ditinjau". Tidak disimpan di data soal.
async function latestAnalysis(client) {
  const {rows} = await client.query(
    `SELECT DISTINCT ON (result.question_id) result.question_id AS id, result.version, result.analyzed, result.priority, result.run_id AS "runId",
       run.created, decision.decision
     FROM analysis_results AS result
     JOIN analysis_runs AS run ON run.id = result.run_id
     LEFT JOIN follow_up_decisions AS decision ON decision.run_id = result.run_id AND decision.question_id = result.question_id
     WHERE result.analyzed
     ORDER BY result.question_id, run.created DESC`,
  )
  return new Map(rows.map(({id, ...row}) => [id, row]))
}

async function updateQuestion(client, question) {
  await client.query('UPDATE questions SET data = $1, updated = $2 WHERE id = $3', [question, question.updated, question.id])
}

async function insertPackage(client, item) {
  const {rowCount} = await client.query(
    'INSERT INTO exam_packages (id, name, course, created) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
    [item.id, item.name, item.course, item.created],
  )
  return rowCount === 1
}

async function insertPackageItems(client, packageId, questions) {
  await client.query(
    `INSERT INTO package_items (package_id, question_id, version, position)
     SELECT $1, id, version, ordinality - 1
     FROM unnest($2::text[], $3::integer[]) WITH ORDINALITY AS item(id, version, ordinality)`,
    [packageId, questions.map(({id}) => id), questions.map(({version}) => version)],
  )
}

async function listPackages(client, id = null) {
  const {rows} = await client.query(
    `SELECT package.id, package.name, package.course, package.created,
       COALESCE(jsonb_agg(jsonb_build_object(
         'questionId', item.question_id, 'version', item.version, 'title', versions.snapshot->>'title',
         'topic', versions.snapshot->>'topic', 'level', versions.snapshot->>'level'
       ) ORDER BY item.position) FILTER (WHERE item.question_id IS NOT NULL), '[]'::jsonb) AS items
     FROM exam_packages AS package
     LEFT JOIN package_items AS item ON item.package_id = package.id
     LEFT JOIN question_versions AS versions ON versions.question_id = item.question_id AND versions.version = item.version
     WHERE ($1::text IS NULL OR package.id = $1)
     GROUP BY package.id
     ORDER BY package.created DESC, package.id`,
    [id],
  )
  return rows
}

async function seed(client) {
  for (const question of seedQuestions) {
    await insertQuestion(client, question)
    await addVersion(client, question, 'Data contoh awal.', question.owner)
  }
  const questions = new Map(seedQuestions.map((question) => [question.id, question]))
  for (const item of seedPackages) {
    await insertPackage(client, {...item, created: item.created + '+07:00'})
    await insertPackageItems(client, item.id, item.questionIds.map((id) => questions.get(id)))
  }
}

export async function openWorkspace(pool) {
  try {
    await initializeDatabase(pool, 'demo', seed)
  } catch (error) {
    await pool.end()
    throw error
  }

  async function createQuestion(client, id, fields, status, note, account, metadata = {}) {
    const question = {...fields, ...metadata, id, status, updated: now(), version: 1, revision: 1, owner: account.name, faculty: 'FMIPA', program: 'Informatika', priority: 'Normal'}
    if (!(await insertQuestion(client, question))) {
      const current = await requireQuestion(client, id)
      if (sameFields(current, fields) && current.status === status) return current
      throw new ApiError(409, 'ID soal sudah tersimpan. Muat ulang daftar soal sebelum menyimpan lagi.')
    }
    await addVersion(client, question, note || 'Versi awal.', account.username)
    await record(client, account.username, 'question.created', question)
    if (status === 'review') await record(client, account.username, 'review.submitted', question)
    return question
  }

  async function saveGeneratedQuestions(items, account) {
    const validated = items.map(({fields, suggestedMetadata}) => ({
      fields: questionInput({...fields, status: 'draft'}).fields, suggestedMetadata,
    }))
    return transaction(pool, async (client) => {
      const drafts = []
      for (const {fields, suggestedMetadata} of validated) {
        drafts.push(await createQuestion(client, `BS-${randomUUID().toUpperCase()}`, fields, 'draft', 'Draf dibuat melalui generator AI.', account, {source: 'ai', suggestedMetadata}))
      }
      return drafts
    })
  }

  async function saveQuestion(id, body, existing, account) {
    if (!existing) requestId(id, 'BS-')
    const {fields, status, note} = questionInput(body)
    return transaction(pool, async (client) => {
      if (!existing) {
        return createQuestion(client, id, fields, status, note, account)
      }

      const current = await requireQuestion(client, id, true)
      checkRevision(current, body.revision)
      if (!editableStatuses.includes(current.status)) {
        throw new ApiError(409, 'Hanya soal draf atau perlu revisi yang dapat diedit.')
      }
      const contentChanged = !sameFields(current, fields)
      if (!contentChanged && current.status === status) return current
      const question = {
        ...current, ...fields, status, updated: now(), version: current.version + Number(contentChanged), revision: current.revision + 1,
      }
      await updateQuestion(client, question)
      if (contentChanged) await addVersion(client, question, note || 'Isi atau metadata soal diperbarui.', account.username)
      if (contentChanged || status === 'draft') await record(client, account.username, 'question.updated', question)
      if (status === 'review') await record(client, account.username, 'review.submitted', question)
      return question
    })
  }

  async function decide(id, body, account) {
    const data = inputObject(body)
    const status = choiceField(data.status, Object.keys(decisions), 'Keputusan review')
    const note = stringField(data.note ?? '', 'Catatan review', 2_000, status !== 'approved')
    return transaction(pool, async (client) => {
      const current = await requireQuestion(client, id, true)
      checkRevision(current, data.revision)
      if (current.status !== 'review') throw new ApiError(409, 'Soal ini sudah keluar dari antrean review.')
      const question = {...current, status, reviewNote: note || undefined, revision: current.revision + 1, updated: now()}
      if (status === 'approved') delete question.analysisContext
      await updateQuestion(client, question)
      await record(client, account.username, decisions[status], question, note)
      return question
    })
  }

  async function history(id) {
    return transaction(pool, async (client) => {
      await requireQuestion(client, id)
      const {rows: versions} = await client.query(
        'SELECT version, created, actor, note, snapshot FROM question_versions WHERE question_id = $1 ORDER BY version DESC', [id],
      )
      const {rows: reviews} = await client.query(
        'SELECT version, actor, created, action, note FROM audit_entries WHERE entity_id = $1 AND action = ANY($2::text[]) ORDER BY id DESC',
        [id, Object.values(decisions)],
      )
      const {rows: usage} = await client.query(
        'SELECT package.id, package.name, item.version, package.created FROM package_items AS item ' +
        'JOIN exam_packages AS package ON package.id = item.package_id WHERE item.question_id = $1 ORDER BY package.created DESC',
        [id],
      )
      return {versions, reviews: reviews.map(({action, ...row}) => ({...row, status: decisionStatus[action]})), usage}
    }, true)
  }

  async function savePackage(body, account) {
    const data = inputObject(body)
    const id = requestId(data.id, 'PK-')
    const name = stringField(data.name, 'Nama paket', 180)
    const course = choiceField(data.course, courses, 'Mata kuliah')
    const ids = data.questionIds
    if (!Array.isArray(ids) || !ids.length || ids.length > 200 || ids.some((item) => typeof item !== 'string') || new Set(ids).size !== ids.length) {
      throw new ApiError(400, 'Pilih 1 sampai 200 soal yang berbeda.')
    }

    return transaction(pool, async (client) => {
      const created = now()
      if (!(await insertPackage(client, {id, name, course, created}))) {
        const [item] = await listPackages(client, id)
        if (name === item.name && course === item.course && ids.length === item.items.length && ids.every((value, index) => value === item.items[index].questionId)) return item
        throw new ApiError(409, 'ID paket sudah tersimpan. Buka kembali daftar paket.')
      }

      const {rows} = await client.query('SELECT id, data FROM questions WHERE id = ANY($1::text[]) ORDER BY id FOR SHARE', [ids])
      if (rows.length !== ids.length) throw new ApiError(404, 'Satu atau beberapa soal tidak ditemukan.')
      const byId = new Map(rows.map((row) => [row.id, row.data]))
      const questions = ids.map((value) => byId.get(value))
      if (questions.some((question) => question.status !== 'approved' || question.course !== course)) {
        throw new ApiError(409, 'Paket hanya bisa memuat soal disetujui dari mata kuliah yang dipilih.')
      }

      await insertPackageItems(client, id, questions)
      await record(client, account.username, 'package.created', {id, title: name, updated: created})
      const [item] = await listPackages(client, id)
      return item
    })
  }

  async function exportReport(body, account) {
    const data = inputObject(body)
    const course = choiceField(data.course, ['', ...courses], 'Mata kuliah')
    const questions = (await listQuestions(pool)).filter((question) => !course || question.course === course)
    const csv = serializeCsv([
      ['id_soal', 'versi', 'judul', 'mata_kuliah', 'status'],
      ...questions.map((question) => [question.id, question.version, question.title, question.course, statusInfo[question.status].label]),
    ])
    await record(pool, account.username, 'report.exported', {id: 'laporan-bank-soal', title: course || 'Semua mata kuliah', updated: now()})
    return csv
  }

  const analysis = createAnalysis(pool, {record, requireQuestion, updateQuestion})

  return {
    list: () => transaction(pool, async (client) => {
      const analyses = await latestAnalysis(client)
      const questions = (await listQuestions(client)).map((question) => analyses.has(question.id) ? {...question, analysis: analyses.get(question.id)} : question)
      return {questions, packages: await listPackages(client)}
    }, true),
    saveQuestion, decide, history, savePackage, saveGeneratedQuestions, exportReport, analysis,
    async audit() {
      const {rows} = await pool.query('SELECT id, action, entity_id AS "entityId", title, version, actor, created FROM audit_entries ORDER BY id DESC LIMIT 100')
      return rows
    },
    health: () => pool.query('SELECT 1'),
    close: () => pool.end(),
  }
}
