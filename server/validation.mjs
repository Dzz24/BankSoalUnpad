import { courses, formats, levels } from '../shared/question-fields.js'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function inputObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Kirim data JSON yang valid.')
  }
  return body
}

export function stringField(value, label, maxLength, required = true) {
  if (typeof value !== 'string') throw new ApiError(400, `${label} harus berupa teks.`)
  const trimmed = value.trim()
  if (required && !trimmed) throw new ApiError(400, `${label} wajib diisi.`)
  if (trimmed.length > maxLength) throw new ApiError(400, `${label} maksimal ${maxLength} karakter.`)
  return trimmed
}

export function choiceField(value, options, label) {
  if (!options.includes(value)) throw new ApiError(400, `${label} tidak dikenali.`)
  return value
}

export function requestId(value, prefix) {
  if (typeof value !== 'string' || !value.startsWith(prefix) || !/^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/.test(value.slice(prefix.length))) {
    throw new ApiError(400, 'ID untuk data baru tidak valid.')
  }
  return value
}

export function questionInput(body) {
  const data = inputObject(body)
  const format = choiceField(data.format, formats, 'Format soal')
  const status = choiceField(data.status, ['draft', 'review'], 'Status pengajuan')
  const optionCount = format === 'Pilihan Ganda' ? 4 : 2
  if (!Array.isArray(data.options) || data.options.length !== optionCount) {
    throw new ApiError(400, `Format ini memerlukan ${optionCount} pilihan jawaban.`)
  }
  const options = data.options.map((option, index) => stringField(option, `Opsi ${index + 1}`, 2_000))
  if (format === 'Benar/Salah' && (options[0] !== 'Benar' || options[1] !== 'Salah')) {
    throw new ApiError(400, 'Gunakan opsi Benar dan Salah pada format ini.')
  }
  if (new Set(options.map((option) => option.toLocaleLowerCase('id'))).size !== options.length) {
    throw new ApiError(400, 'Setiap pilihan jawaban harus berbeda.')
  }
  if (!Number.isInteger(data.answer) || data.answer < 0 || data.answer >= optionCount) {
    throw new ApiError(400, 'Kunci jawaban harus menunjuk salah satu opsi.')
  }
  return {
    fields: {
      title: stringField(data.title, 'Judul soal', 180),
      course: choiceField(data.course, courses, 'Mata kuliah'),
      topic: stringField(data.topic, 'Topik', 180),
      level: choiceField(data.level, levels, 'Level kognitif'),
      format,
      stem: stringField(data.stem, 'Pertanyaan', 8_000),
      options,
      answer: data.answer,
      explanation: stringField(data.explanation ?? '', 'Pembahasan', 8_000, status === 'review'),
    },
    status,
    note: stringField(data.changeNote ?? '', 'Catatan perubahan', 1_000, false),
  }
}

export function checkRevision(question, revision) {
  if (!Number.isInteger(revision) || revision < 1) throw new ApiError(400, 'Revisi data wajib disertakan.')
  if (question.revision !== revision) {
    throw new ApiError(409, 'Soal berubah sejak dibuka. Muat ulang data sebelum mencoba lagi.')
  }
}
