import { Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cognitiveLevels } from '../shared/question-fields.js'
import { generateQuestions, type GenerationInput } from './api'
import { courses, type Question } from './data'

export function QuestionGenerator({course, topic, onGenerated, onPendingChange}: {
  course: Question['course']; topic: string
  onGenerated: (drafts: Question[]) => void; onPendingChange: (pending: boolean) => void
}) {
  const [input, setInput] = useState<GenerationInput>({mode: 'topic', material: '', topic, course, count: 3, cognitiveLevel: 'penerapan'})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {active.current = false}
  }, [])

  function change<K extends keyof GenerationInput>(key: K, value: GenerationInput[K]) {
    setInput((previous) => ({...previous, [key]: value}))
    setError('')
  }

  async function generate() {
    if (inFlight.current) return
    if (!input.topic.trim()) {
      setError('Isi topik untuk membuat soal.')
      return
    }
    if (input.mode === 'material' && !input.material.trim()) {
      setError('Isi materi rujukan untuk membuat soal dari materi.')
      return
    }
    if (!Number.isInteger(input.count) || input.count < 1 || input.count > 10) {
      setError('Pilih jumlah soal antara 1 dan 10.')
      return
    }
    inFlight.current = true
    setPending(true)
    onPendingChange(true)
    setError('')
    try {
      const {drafts} = await generateQuestions({...input, material: input.mode === 'topic' ? '' : input.material})
      if (active.current) onGenerated(drafts)
    } catch (reason) {
      if (active.current) setError(reason instanceof Error ? reason.message : 'Pembuatan soal gagal. Coba kembali.')
    } finally {
      inFlight.current = false
      if (active.current) {
        setPending(false)
        onPendingChange(false)
      }
    }
  }

  const level = cognitiveLevels.find((item) => item.value === input.cognitiveLevel)
  return <section className="ai-generator" aria-labelledby="generator-title" aria-busy={pending}>
    <div><h3 id="generator-title">Buat Draf dengan AI</h3><p className="muted">Tentukan topik atau berikan materi rujukan. Hasil akan disimpan sebagai draf untuk kamu periksa dan sunting.</p></div>
    <fieldset disabled={pending} className="generator-fields">
      <label className="field">Sumber Pembuatan Soal<select value={input.mode} onChange={(event) => change('mode', event.target.value as GenerationInput['mode'])}>
        <option value="topic">AI dari Topik</option><option value="material">Dari Materi Rujukan</option>
      </select></label>
      <p className="muted">{input.mode === 'topic' ? 'AI menyusun soal dari pengetahuannya berdasarkan topik dan mata kuliah yang kamu pilih.' : 'AI menyusun soal berdasarkan materi yang kamu masukkan.'}</p>
      <div className="form-grid">
        <label className="field">Mata Kuliah<select value={input.course} onChange={(event) => change('course', event.target.value as GenerationInput['course'])}>{courses.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field">Topik<input maxLength={180} value={input.topic} onChange={(event) => change('topic', event.target.value)} placeholder="Misalnya, normalisasi basis data" /></label>
        <label className="field">Jumlah Soal<input type="number" min={1} max={10} step={1} value={Number.isNaN(input.count) ? '' : input.count} onChange={(event) => change('count', event.target.valueAsNumber)} /></label>
        <label className="field">Level Kognitif<select value={input.cognitiveLevel} onChange={(event) => change('cognitiveLevel', event.target.value as GenerationInput['cognitiveLevel'])}>{cognitiveLevels.map((item) => <option key={item.id} value={item.value}>{item.id} · {item.label}</option>)}</select></label>
      </div>
      <p className="muted">{level?.description}</p>
      {input.mode === 'material' && <>
        <label className="field">Materi Rujukan<textarea rows={8} maxLength={20_000} value={input.material} onChange={(event) => change('material', event.target.value)} placeholder="Tempel materi kuliah yang menjadi sumber soal di sini…" /></label>
        <small className="muted">{input.material.length.toLocaleString('id-ID')} / 20.000 karakter · Materi dikirim ke layanan AI untuk menyusun soal.</small>
      </>}
      <button type="button" className="button primary" onClick={() => void generate()}><Sparkles size={17} /> {pending ? 'Menyusun draf…' : 'Buat Draf Soal'}</button>
    </fieldset>
    {pending && <p role="status" className="muted">AI sedang menyusun soal dan memeriksa kelengkapan hasil.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
