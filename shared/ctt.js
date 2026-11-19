// Analisis butir soal berbasis Classical Test Theory (CTT).
//
// Modul ini hanya menghitung. Impor CSV/XLSX, validasi impor, dan penyimpanan
// dikerjakan backend. Satu pemanggilan analyzeCtt() = satu kali ujian (satu
// dataset impor), karena daya pembeda dan reliabilitas bergantung pada skor
// total peserta pada ujian yang sama.

/**
 * @typedef {{participantId: string, itemId: string, version: number | string, response: string | null | undefined}} CttResponse
 * @typedef {{itemId: string, version: number | string, key: string, optionCount: number, format?: string}} CttItem
 * @typedef {{
 *   blank: 'incorrect' | 'exclude',
 *   groupFraction: number,
 *   minParticipants: number,
 *   adequateParticipants: number,
 *   distractorMinShare: number,
 *   lowDiscrimination: number,
 *   easyFrom: number,
 *   hardBelow: number,
 * }} CttOptions
 */

/** @type {CttOptions} */
export const defaultCttOptions = Object.freeze({
  // Respons kosong: 'incorrect' = skor 0 dan ikut skor total; 'exclude' = tidak dihitung pada soal itu.
  blank: 'incorrect',
  // Porsi kelompok atas dan bawah untuk indeks daya pembeda D.
  groupFraction: 0.27,
  // Di bawah batas ini indeks tidak dihitung (data belum memadai).
  minParticipants: 10,
  // Di bawah batas ini hasil dihitung tetapi ditandai indikatif.
  adequateParticipants: 30,
  // Pengecoh dianggap berfungsi bila dipilih minimal porsi ini dari peserta.
  distractorMinShare: 0.05,
  // Penanda daya pembeda rendah (indeks D), sama dengan halaman Analisis Kualitas.
  lowDiscrimination: 0.25,
  // Batas kategori kesulitan, sama dengan halaman Analisis Kualitas.
  easyFrom: 0.7,
  hardBelow: 0.4,
})

const TRUE_FALSE_FORMAT = 'Benar/Salah'

/** Mengubah indeks kunci (0, 1, 2, ...) menjadi label opsi (A, B, C, ...). */
export function optionLabel(index) {
  if (!Number.isInteger(index) || index < 0 || index > 25) throw new RangeError(`Indeks opsi tidak valid: ${index}`)
  return String.fromCharCode(65 + index)
}

/** Kunci gabungan untuk satu versi soal, misalnya "BS-240@1". */
export function itemVersionKey(itemId, version) {
  return `${String(itemId).trim()}@${Number(version)}`
}

/** Mengubah baris CSV template (id_peserta, id_soal, versi_soal, respons) ke bentuk input analisis. */
export function responsesFromCsvRows(rows) {
  return rows.map((row) => ({participantId: row.id_peserta, itemId: row.id_soal, version: row.versi_soal, response: row.respons}))
}

/**
 * Menjalankan analisis CTT untuk satu dataset ujian.
 * @param {{responses: CttResponse[], items: CttItem[], options?: Partial<CttOptions>}} input
 */
export function analyzeCtt({responses, items, options = {}}) {
  const settings = {...defaultCttOptions, ...options}
  if (settings.blank !== 'incorrect' && settings.blank !== 'exclude') throw new Error("Opsi blank harus 'incorrect' atau 'exclude'.")
  /** @type {Array<{type: string, message: string, participantId?: string, itemKey?: string}>} */
  const issues = []

  const itemList = items.map((item) => {
    const key = itemVersionKey(item.itemId, item.version)
    const labels = Array.from({length: item.optionCount}, (_, index) => optionLabel(index))
    const answer = normalizeResponse(item.key)
    if (!answer || !labels.includes(answer)) throw new Error(`Kunci ${item.key} untuk ${key} tidak ada di antara opsi ${labels.join(', ')}.`)
    const trueFalse = item.format === TRUE_FALSE_FORMAT || item.optionCount === 2
    return {key, itemId: String(item.itemId).trim(), version: Number(item.version), answer, labels, format: item.format ?? null, trueFalse}
  })
  const itemsByKey = new Map(itemList.map((item) => [item.key, item]))
  if (itemsByKey.size !== itemList.length) throw new Error('Daftar soal berisi versi soal yang sama lebih dari sekali.')

  // Kumpulkan jawaban per peserta per versi soal.
  /** @type {Map<string, Map<string, string | null>>} */
  const answers = new Map()
  for (const row of responses) {
    const participantId = String(row.participantId ?? '').trim()
    const itemKey = itemVersionKey(row.itemId, row.version)
    if (!participantId) {
      issues.push({type: 'participant-missing', message: 'Baris tanpa ID peserta diabaikan.', itemKey})
      continue
    }
    if (!itemsByKey.has(itemKey)) {
      issues.push({type: 'unknown-item', message: `Versi soal ${itemKey} tidak ada di daftar kunci; baris diabaikan.`, participantId, itemKey})
      continue
    }
    const sheet = answers.get(participantId) ?? new Map()
    if (sheet.has(itemKey)) {
      issues.push({type: 'duplicate', message: `Peserta ${participantId} punya lebih dari satu jawaban untuk ${itemKey}; jawaban pertama dipakai.`, participantId, itemKey})
      continue
    }
    sheet.set(itemKey, normalizeResponse(row.response))
    answers.set(participantId, sheet)
  }

  const participants = [...answers.keys()].sort()
  const participantCount = participants.length

  // Bentuk matriks skor. Nilai null berarti tidak dihitung (hanya bila blank = 'exclude').
  /** @type {Map<string, Map<string, {choice: string, score: number | null}>>} */
  const matrix = new Map()
  for (const participantId of participants) {
    const sheet = answers.get(participantId)
    const row = new Map()
    for (const item of itemList) {
      let choice
      if (!sheet.has(item.key)) {
        choice = 'missing'
        issues.push({type: 'missing-row', message: `Peserta ${participantId} tidak punya baris untuk ${item.key}; diperlakukan seperti respons kosong.`, participantId, itemKey: item.key})
      } else {
        const value = sheet.get(item.key)
        choice = value === null ? 'blank' : item.labels.includes(value) ? value : 'invalid'
      }
      let score
      if (choice === item.answer) score = 1
      else if (item.labels.includes(choice)) score = 0
      else score = settings.blank === 'incorrect' ? 0 : null
      row.set(item.key, {choice, score})
    }
    matrix.set(participantId, row)
  }

  const totals = new Map(participants.map((participantId) => {
    let total = 0
    for (const cell of matrix.get(participantId).values()) total += cell.score ?? 0
    return [participantId, total]
  }))

  // Kelompok atas dan bawah: urut skor total menurun; skor sama diurutkan menurut ID peserta agar hasil tetap.
  const ranked = [...participants].sort((a, b) => totals.get(b) - totals.get(a) || a.localeCompare(b))
  const groupSize = participantCount ? Math.max(1, Math.round(settings.groupFraction * participantCount)) : 0
  const upper = new Set(ranked.slice(0, groupSize))
  const lower = new Set(ranked.slice(participantCount - groupSize))
  const groupNotes = []
  if (groupSize && groupSize * 2 > participantCount) groupNotes.push('Kelompok atas dan bawah saling tumpang tindih karena peserta terlalu sedikit.')
  if (groupSize && groupSize < participantCount) {
    if (totals.get(ranked[groupSize - 1]) === totals.get(ranked[groupSize])) groupNotes.push('Ada skor total sama di batas kelompok atas; pembagian memakai urutan ID peserta.')
    const lowerStart = participantCount - groupSize
    if (lowerStart > 0 && totals.get(ranked[lowerStart - 1]) === totals.get(ranked[lowerStart])) groupNotes.push('Ada skor total sama di batas kelompok bawah; pembagian memakai urutan ID peserta.')
  }

  const itemResults = itemList.map((item) => analyzeItem(item, participants, matrix, totals, upper, lower, settings))

  return {
    settings,
    participantCount,
    itemCount: itemList.length,
    groups: {size: groupSize, upper: [...upper], lower: [...lower], notes: groupNotes},
    items: itemResults,
    test: summarizeTest(itemResults, participants, matrix, totals, itemList, settings),
    issues,
  }
}

function normalizeResponse(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim().toUpperCase()
  return text === '' ? null : text
}

function analyzeItem(item, participants, matrix, totals, upper, lower, settings) {
  const counted = participants.filter((participantId) => matrix.get(participantId).get(item.key).score !== null)
  const n = counted.length
  const cell = (participantId) => matrix.get(participantId).get(item.key)

  // Distribusi pilihan dihitung dari semua peserta.
  const choices = [...item.labels, 'blank', 'invalid', 'missing']
  const distribution = Object.fromEntries(choices.map((choice) => [choice, {count: 0, upper: 0, lower: 0, share: 0}]))
  for (const participantId of participants) {
    const entry = distribution[cell(participantId).choice]
    entry.count += 1
    if (upper.has(participantId)) entry.upper += 1
    if (lower.has(participantId)) entry.lower += 1
  }
  for (const entry of Object.values(distribution)) entry.share = participants.length ? entry.count / participants.length : 0

  const notes = []
  let sufficiency = 'adequate'
  if (n < settings.minParticipants) {
    sufficiency = 'insufficient'
    notes.push(`Hanya ${n} respons yang dihitung (minimal ${settings.minParticipants}); indeks tidak dihitung.`)
  } else if (n < settings.adequateParticipants) {
    sufficiency = 'indicative'
    notes.push(`${n} respons dihitung (di bawah ${settings.adequateParticipants}); hasil bersifat indikatif.`)
  }

  const result = {
    itemId: item.itemId,
    version: item.version,
    key: item.answer,
    format: item.format,
    n,
    sufficiency,
    difficulty: null,
    difficultyBand: null,
    discrimination: null,
    upperCorrect: null,
    lowerCorrect: null,
    pointBiserial: null,
    distribution,
    distractors: null,
    distractorCount: item.trueFalse ? 0 : item.labels.length - 1,
    effectiveDistractors: null,
    flags: [],
    notes,
  }
  if (item.trueFalse) notes.push('Analisis pengecoh tidak berlaku untuk soal dua opsi.')
  if (distribution.invalid.count) notes.push(`${distribution.invalid.count} respons tidak sesuai opsi soal.`)
  if (distribution.blank.count + distribution.missing.count) notes.push(`${distribution.blank.count + distribution.missing.count} respons kosong (${settings.blank === 'incorrect' ? 'dihitung salah' : 'tidak dihitung'}).`)
  if (sufficiency === 'insufficient') return result

  const scores = counted.map((participantId) => cell(participantId).score)
  const correct = scores.reduce((sum, score) => sum + score, 0)
  result.difficulty = correct / n
  result.difficultyBand = result.difficulty >= settings.easyFrom ? 'Mudah' : result.difficulty < settings.hardBelow ? 'Sulit' : 'Sedang'

  // Indeks D = proporsi benar kelompok atas - proporsi benar kelompok bawah.
  const groupProportion = (group) => {
    const members = counted.filter((participantId) => group.has(participantId))
    if (!members.length) return null
    return {correct: members.reduce((sum, participantId) => sum + cell(participantId).score, 0), size: members.length}
  }
  const top = groupProportion(upper)
  const bottom = groupProportion(lower)
  if (top && bottom) {
    result.upperCorrect = top.correct
    result.lowerCorrect = bottom.correct
    result.discrimination = top.correct / top.size - bottom.correct / bottom.size
  } else notes.push('Kelompok atas atau bawah tidak punya respons yang dihitung; indeks D tidak dihitung.')

  // Korelasi point-biserial terkoreksi: skor butir dengan skor total tanpa butir itu.
  const rest = counted.map((participantId) => totals.get(participantId) - cell(participantId).score)
  result.pointBiserial = pearson(scores, rest)
  if (result.pointBiserial === null) notes.push('Point-biserial tidak dihitung karena skor butir atau skor sisa tidak bervariasi.')

  if (!item.trueFalse) {
    const minimum = settings.distractorMinShare * participants.length
    result.distractors = item.labels.filter((label) => label !== item.answer).map((label) => {
      const entry = distribution[label]
      const chosenEnough = entry.count > 0 && entry.count >= minimum
      const pullsLower = entry.lower > entry.upper
      return {option: label, count: entry.count, share: entry.share, upper: entry.upper, lower: entry.lower, effective: chosenEnough && pullsLower}
    })
    result.effectiveDistractors = result.distractors.filter((distractor) => distractor.effective).length
    if (result.effectiveDistractors < result.distractorCount) result.flags.push('distractor-review')
  }
  if (result.discrimination !== null && result.discrimination < settings.lowDiscrimination) result.flags.push('low-discrimination')
  return result
}

function summarizeTest(itemResults, participants, matrix, totals, itemList, settings) {
  const analyzed = itemResults.filter((item) => item.difficulty !== null)
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  const totalScores = participants.map((participantId) => totals.get(participantId))
  const scoreMean = mean(totalScores)
  const variance = totalScores.length ? totalScores.reduce((sum, value) => sum + (value - scoreMean) ** 2, 0) / totalScores.length : null
  const withDistractors = analyzed.filter((item) => item.effectiveDistractors !== null)
  const distractorTotal = withDistractors.reduce((sum, item) => sum + item.distractorCount, 0)

  const reliability = {kr20: null, note: null}
  const complete = participants.every((participantId) => [...matrix.get(participantId).values()].every((cell) => cell.score !== null))
  if (itemList.length < 2) reliability.note = 'KR-20 memerlukan minimal 2 soal.'
  else if (participants.length < settings.minParticipants) reliability.note = `KR-20 memerlukan minimal ${settings.minParticipants} peserta.`
  else if (!complete) reliability.note = 'KR-20 tidak dihitung karena ada respons yang tidak dihitung (aturan kosong = exclude).'
  else if (!variance) reliability.note = 'KR-20 tidak dihitung karena skor total tidak bervariasi.'
  else {
    // KR-20 = k/(k-1) * (1 - Σpq / σ²), σ² memakai pembagi N agar sejalan dengan p dan q.
    const sumPq = itemResults.reduce((sum, item) => {
      const p = mean(participants.map((participantId) => matrix.get(participantId).get(itemVersionKey(item.itemId, item.version)).score))
      return sum + p * (1 - p)
    }, 0)
    const k = itemList.length
    reliability.kr20 = (k / (k - 1)) * (1 - sumPq / variance)
  }

  return {
    participantCount: participants.length,
    itemCount: itemResults.length,
    analyzedItemCount: analyzed.length,
    scoreMean,
    scoreVariance: variance,
    averageDifficulty: mean(analyzed.map((item) => item.difficulty)),
    averageDiscrimination: mean(analyzed.filter((item) => item.discrimination !== null).map((item) => item.discrimination)),
    effectiveDistractorShare: distractorTotal ? withDistractors.reduce((sum, item) => sum + item.effectiveDistractors, 0) / distractorTotal : null,
    reliability,
  }
}

function pearson(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n
  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (let index = 0; index < n; index += 1) {
    const dx = xs[index] - meanX
    const dy = ys[index] - meanY
    covariance += dx * dy
    varianceX += dx * dx
    varianceY += dy * dy
  }
  if (!varianceX || !varianceY) return null
  return covariance / Math.sqrt(varianceX * varianceY)
}
