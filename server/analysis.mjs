// Impor respons ujian, analisis CTT, dan tindak lanjut soal (branch eksperimen exp/ctt-alur-penuh).
// Alur dan aturannya mengikuti docs/rencana-tindak-lanjut-analisis.md.
import { randomUUID } from 'node:crypto'
import { isValidPeriod } from '../shared/academic-period.js'
import { analyzeCtt, CTT_METHOD_VERSION, optionLabel } from '../shared/ctt.js'
import { transaction } from './database.mjs'
import { ApiError, checkRevision, choiceField, inputObject, requestId, stringField } from './validation.mjs'

const MAX_ROWS = 50_000
const MAX_ERRORS = 100
const participantPattern = /^[A-Za-z0-9._-]{1,64}$/
const decisionInfo = {
  keep: {action: 'analysis.kept', label: 'Pertahankan'},
  revise: {action: 'analysis.revision_requested', label: 'Revisi'},
  retire: {action: 'question.retired', label: 'Pensiunkan'},
}

async function packageItems(client, packageId) {
  const {rows} = await client.query(
    `SELECT item.question_id AS id, item.version, versions.snapshot
     FROM package_items AS item
     JOIN question_versions AS versions ON versions.question_id = item.question_id AND versions.version = item.version
     WHERE item.package_id = $1 ORDER BY item.position`,
    [packageId],
  )
  return rows
}

/** Validasi baris respons terhadap isi paket (NFR-09). Mengembalikan galat per baris tanpa memproses data diam-diam. */
export function validateResponses(rows, items) {
  const errors = []
  const byId = new Map(items.map((item) => [item.id, item]))
  const seen = new Set()
  const participants = new Map()
  const clean = []
  const fail = (row, message) => {
    if (errors.length < MAX_ERRORS) errors.push({row, message})
  }
  let errorCount = 0

  rows.forEach((raw, index) => {
    const row = index + 2
    if (!raw || typeof raw !== 'object') {
      errorCount += 1
      fail(row, 'Baris tidak terbaca.')
      return
    }
    const participant = String(raw.id_peserta ?? '').trim()
    const questionId = String(raw.id_soal ?? '').trim()
    const versionText = String(raw.versi_soal ?? '').trim()
    const response = String(raw.respons ?? '').trim().toUpperCase()
    const problems = []
    const item = byId.get(questionId)
    if (!participantPattern.test(participant)) problems.push('ID peserta harus 1–64 karakter huruf, angka, titik, garis bawah, atau tanda hubung')
    if (!item) problems.push(`soal ${questionId || '(kosong)'} tidak ada di paket ini`)
    else if (Number(versionText) !== item.version) problems.push(`versi ${versionText || '(kosong)'} tidak sesuai; paket memakai versi ${item.version}`)
    if (item && response) {
      const labels = item.snapshot.options.map((_, optionIndex) => optionLabel(optionIndex))
      if (!labels.includes(response)) problems.push(`respons ${response} tidak ada di opsi ${labels.join('/')}`)
    }
    const key = `${participant}\u0000${questionId}`
    if (participant && questionId && seen.has(key)) problems.push('jawaban ganda untuk peserta dan soal yang sama')
    seen.add(key)
    if (problems.length) {
      errorCount += 1
      fail(row, problems.join('; ') + '.')
      return
    }
    clean.push({participant, questionId, version: item.version, response})
    const answered = participants.get(participant) ?? new Set()
    answered.add(questionId)
    participants.set(participant, answered)
  })

  for (const [participant, answered] of participants) {
    const missing = items.filter((item) => !answered.has(item.id))
    if (missing.length) {
      errorCount += 1
      fail(null, `Peserta ${participant} belum punya baris untuk ${missing.length} soal (${missing.slice(0, 3).map((item) => item.id).join(', ')}${missing.length > 3 ? ', …' : ''}). Isi respons kosong bila tidak dijawab.`)
    }
  }
  return {errors, errorCount, clean, participantCount: participants.size}
}

export function createAnalysis(pool, {record, requireQuestion, updateQuestion}) {
  const now = () => new Date().toISOString()

  async function createImport(body, account) {
    const data = inputObject(body)
    const id = requestId(data.id, 'IMP-')
    const packageId = stringField(data.packageId, 'Paket ujian', 80)
    const period = stringField(data.period, 'Periode', 60)
    if (!isValidPeriod(period)) throw new ApiError(400, 'Periode harus dipilih dari daftar semester dan tahun akademik.')
    const fileName = stringField(data.fileName, 'Nama file', 180)
    if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > MAX_ROWS) {
      throw new ApiError(400, `File harus berisi 1 sampai ${MAX_ROWS.toLocaleString('id-ID')} baris respons.`)
    }

    return transaction(pool, async (client) => {
      const {rows: [existing]} = await client.query('SELECT id FROM exam_imports WHERE id = $1', [id])
      if (existing) throw new ApiError(409, 'Impor ini sudah tersimpan. Muat ulang riwayat impor.')
      const {rows: [pkg]} = await client.query('SELECT id, name FROM exam_packages WHERE id = $1', [packageId])
      if (!pkg) throw new ApiError(404, 'Paket ujian tidak ditemukan.')
      const items = await packageItems(client, packageId)
      const result = validateResponses(data.rows, items)
      if (result.errorCount) {
        throw Object.assign(new ApiError(422, `File belum bisa disimpan: ${result.errorCount} masalah ditemukan. Perbaiki file lalu unggah ulang.`), {errors: result.errors, errorCount: result.errorCount})
      }
      const created = now()
      await client.query(
        'INSERT INTO exam_imports (id, package_id, period, file_name, participant_count, row_count, actor, created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, packageId, period, fileName, result.participantCount, result.clean.length, account.username, created],
      )
      await client.query(
        `INSERT INTO exam_responses (import_id, participant_id, question_id, version, response)
         SELECT $1, * FROM unnest($2::text[], $3::text[], $4::integer[], $5::text[])`,
        [id, result.clean.map((row) => row.participant), result.clean.map((row) => row.questionId), result.clean.map((row) => row.version), result.clean.map((row) => row.response)],
      )
      await record(client, account.username, 'import.created', {id, title: `${pkg.name} · ${period}`, updated: created}, `${fileName} · ${result.participantCount} peserta · ${result.clean.length} baris`)
      return (await listImports(client, id))[0]
    })
  }

  async function listImports(client = pool, id = null) {
    const {rows} = await client.query(
      `SELECT imp.id, imp.package_id AS "packageId", pkg.name AS "packageName", pkg.course, imp.period, imp.file_name AS "fileName",
         imp.participant_count AS "participantCount", imp.row_count AS "rowCount", imp.actor, imp.created,
         run.id AS "runId", run.created AS "analyzedAt", run.summary
       FROM exam_imports AS imp
       JOIN exam_packages AS pkg ON pkg.id = imp.package_id
       LEFT JOIN analysis_runs AS run ON run.import_id = imp.id
       WHERE ($1::text IS NULL OR imp.id = $1)
       ORDER BY imp.created DESC, imp.id`,
      [id],
    )
    return rows
  }

  async function runAnalysis(importId, body, account) {
    const data = inputObject(body ?? {})
    const blank = choiceField(data.blank ?? 'incorrect', ['incorrect', 'exclude'], 'Aturan respons kosong')
    return transaction(pool, async (client) => {
      const [item] = await listImports(client, importId)
      if (!item) throw new ApiError(404, 'Impor tidak ditemukan.')
      await client.query('SELECT id FROM exam_imports WHERE id = $1 FOR UPDATE', [importId])
      const {rows: [done]} = await client.query('SELECT id FROM analysis_runs WHERE import_id = $1', [importId])
      if (done) throw new ApiError(409, 'Impor ini sudah dianalisis. Hasil analisis tidak ditimpa.')
      const items = await packageItems(client, item.packageId)
      const {rows: responses} = await client.query(
        'SELECT participant_id AS "participantId", question_id AS "itemId", version, response FROM exam_responses WHERE import_id = $1',
        [importId],
      )
      const analysis = analyzeCtt({
        responses,
        items: items.map(({id, version, snapshot}) => ({itemId: id, version, key: optionLabel(snapshot.answer), optionCount: snapshot.options.length, format: snapshot.format})),
        options: {blank},
      })
      const runId = `AN-${randomUUID().toUpperCase()}`
      const created = now()
      const summary = {...analysis.test, participantCount: analysis.participantCount, groups: analysis.groups,
        followUp: Object.fromEntries(['high', 'medium', 'low'].map((level) => [level, analysis.items.filter((result) => result.followUp?.priority === level).length]))}
      await client.query(
        'INSERT INTO analysis_runs (id, import_id, method, method_version, settings, summary, actor, created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [runId, importId, analysis.method.name, analysis.method.version, analysis.method.settings, summary, account.username, created],
      )
      await client.query(
        `INSERT INTO analysis_results (run_id, question_id, version, analyzed, priority, result)
         SELECT $1, * FROM unnest($2::text[], $3::integer[], $4::boolean[], $5::text[], $6::jsonb[])`,
        [runId, analysis.items.map((result) => result.itemId), analysis.items.map((result) => result.version), analysis.items.map((result) => result.analyzed),
          analysis.items.map((result) => result.followUp?.priority ?? null), analysis.items.map((result) => JSON.stringify(result))],
      )
      await record(client, account.username, 'analysis.completed', {id: importId, title: `${item.packageName} · ${item.period}`, updated: created},
        `CTT v${CTT_METHOD_VERSION} · respons kosong ${blank === 'incorrect' ? 'dihitung salah' : 'tidak dihitung'}`)
      return (await listImports(client, importId))[0]
    })
  }

  async function overview() {
    return transaction(pool, async (client) => {
      const imports = await listImports(client)
      const {rows: results} = await client.query(
        `SELECT result.run_id AS "runId", run.import_id AS "importId", result.question_id AS "questionId", result.version, result.analyzed, result.priority, result.result,
           questions.data->>'title' AS title, questions.data->>'status' AS "currentStatus", (questions.data->>'version')::integer AS "currentVersion",
           questions.data->>'owner' AS owner,
           CASE WHEN decision.decision IS NULL THEN NULL ELSE jsonb_build_object('decision', decision.decision, 'reason', decision.reason, 'actor', decision.actor, 'created', decision.created) END AS decision
         FROM analysis_results AS result
         JOIN analysis_runs AS run ON run.id = result.run_id
         JOIN questions ON questions.id = result.question_id
         LEFT JOIN follow_up_decisions AS decision ON decision.run_id = result.run_id AND decision.question_id = result.question_id
         ORDER BY run.created DESC, result.question_id`,
      )
      return {imports, results}
    }, true)
  }

  async function decide(runId, questionId, body, account) {
    const data = inputObject(body)
    const decision = choiceField(data.decision, Object.keys(decisionInfo), 'Keputusan tindak lanjut')
    const reason = stringField(data.reason, 'Alasan keputusan', 2_000)
    return transaction(pool, async (client) => {
      const {rows: [row]} = await client.query(
        `SELECT result.version, result.analyzed, result.priority, result.result, imp.period, pkg.name AS "packageName"
         FROM analysis_results AS result
         JOIN analysis_runs AS run ON run.id = result.run_id
         JOIN exam_imports AS imp ON imp.id = run.import_id
         JOIN exam_packages AS pkg ON pkg.id = imp.package_id
         WHERE result.run_id = $1 AND result.question_id = $2 FOR UPDATE OF result`,
        [runId, questionId],
      )
      if (!row) throw new ApiError(404, 'Hasil analisis soal tidak ditemukan.')
      if (!row.analyzed) throw new ApiError(409, 'Data soal ini belum memadai, jadi belum ada tindak lanjut yang bisa diputuskan.')
      const {rows: [taken]} = await client.query('SELECT decision FROM follow_up_decisions WHERE run_id = $1 AND question_id = $2', [runId, questionId])
      if (taken) throw new ApiError(409, 'Tindak lanjut untuk hasil ini sudah diputuskan.')

      const current = await requireQuestion(client, questionId, true)
      checkRevision(current, data.revision)
      // Keputusan hanya untuk soal Disetujui pada versi yang dianalisis. Soal yang sedang direvisi, direview, atau
      // sudah dipensiunkan tidak memerlukan keputusan baru: hasilnya disimpan sebagai riwayat, dan status hanya berubah lewat alurnya sendiri.
      if (current.status !== 'approved') throw new ApiError(409, 'Soal ini tidak berstatus Disetujui, jadi tidak perlu keputusan dari hasil ini. Hasilnya tetap tersimpan sebagai riwayat.')
      if (current.version !== row.version) throw new ApiError(409, `Hasil ini untuk versi ${row.version}, sedangkan soal sekarang versi ${current.version}. Keputusan diambil dari hasil analisis versi terbaru.`)
      const updated = now()
      const source = `${row.packageName} · ${row.period}`
      let question = current
      if (decision !== 'keep') {
        const result = row.result
        const context = {runId, source, version: row.version, priority: row.priority, reasons: result.followUp?.reasons ?? [],
          difficulty: result.difficulty, discrimination: result.discrimination, decision, reason, actor: account.username, created: updated}
        question = decision === 'revise'
          ? {...current, status: 'revision', reviewNote: `Revisi dari hasil analisis CTT (${source}): ${reason}`, analysisContext: context, revision: current.revision + 1, updated}
          : {...current, status: 'retired', analysisContext: context, revision: current.revision + 1, updated}
        await updateQuestion(client, question)
      }
      await client.query(
        'INSERT INTO follow_up_decisions (run_id, question_id, version, decision, reason, actor, created) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [runId, questionId, row.version, decision, reason, account.username, updated],
      )
      await record(client, account.username, decisionInfo[decision].action, {...question, version: row.version, updated}, `${source}: ${reason}`)
      return question
    })
  }

  return {createImport, listImports: () => listImports(), runAnalysis, overview, decide}
}
