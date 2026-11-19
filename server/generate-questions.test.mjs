import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { cognitiveLevels } from '../shared/question-fields.js'
import { generateQuestions, generatedQuestionFields, generationInput, validateGeneratedQuestions } from './generate-questions.mjs'

const example = JSON.parse(readFileSync(new URL('../examples/ai-generation.json', import.meta.url), 'utf8'))
const input = generationInput(example.request)
const response = (value) => Response.json({status: 'completed', output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify(value)}]}]})
const options = {provider: 'openai', apiKey: 'test-only-key', fetch: async () => response(example.response)}

test('generates three validated drafts with structured output and maps keys to editor indexes', async () => {
  const result = await generateQuestions(example.request, {...options, fetch: async (url, request) => {
    assert.equal(url, 'https://api.openai.com/v1/responses')
    const body = JSON.parse(request.body)
    assert.equal(body.store, false)
    assert.equal(body.text.format.type, 'json_schema')
    assert.equal(body.text.format.strict, true)
    assert.deepEqual(JSON.parse(body.input), {material: input.material, topic: input.topic})
    assert.match(body.instructions, /C3/)
    assert.equal(request.headers.Authorization, 'Bearer test-only-key')
    assert(request.signal instanceof AbortSignal)
    return response(example.response)
  }})
  assert.equal(result.questions.length, 3)
  for (const [index, question] of result.questions.entries()) {
    const fields = generatedQuestionFields(question, 'Basis Data')
    assert.equal(fields.answer, index)
    assert.equal(fields.level, 'Penerapan')
    assert.equal(fields.format, 'Pilihan Ganda')
  }
})

test('accepts all six cognitive levels and retains existing editor labels', () => {
  for (const level of cognitiveLevels) {
    const request = generationInput({...example.request, cognitiveLevel: level.id})
    assert.equal(request.cognitiveLevel, level.value)
    const output = structuredClone(example.response)
    output.questions.forEach((question) => {question.cognitiveLevel = level.value})
    const validated = validateGeneratedQuestions(output, request)
    assert.equal(generatedQuestionFields(validated.questions[0], 'Basis Data').level, level.label)
  }
})

for (const [name, mutate] of [
  ['missing question', (output) => output.questions.pop()],
  ['missing option', (output) => output.questions[0].options.pop()],
  ['duplicate option IDs', (output) => {output.questions[0].options[1].id = 'A'}],
  ['key outside options', (output) => {output.questions[0].correctOptionId = 'E'}],
  ['empty explanation', (output) => {output.questions[0].explanation = ' '}],
  ['duplicate option text', (output) => {output.questions[0].options[1].text = '  ' + output.questions[0].options[0].text.toUpperCase()}],
  ['duplicate question', (output) => {output.questions[1].stem = output.questions[0].stem}],
  ['wrong cognitive level', (output) => {output.questions[0].cognitiveLevel = 'analisis'}],
  ['missing metadata', (output) => {delete output.questions[0].suggestedMetadata}],
  ['invalid metadata tags', (output) => {output.questions[0].suggestedMetadata.tags = []}],
]) {
  test('rejects ' + name, () => {
    const output = structuredClone(example.response)
    mutate(output)
    assert.throws(() => validateGeneratedQuestions(output, input), {status: 502, code: 'AI_INVALID_OUTPUT'})
  })
}

test('normalizes unordered options before mapping correctOptionId', () => {
  const output = structuredClone(example.response)
  output.questions[0].options.reverse()
  const result = validateGeneratedQuestions(output, input)
  assert.deepEqual(result.questions[0].options.map((option) => option.id), ['A', 'B', 'C', 'D'])
  assert.equal(generatedQuestionFields(result.questions[0], 'Basis Data').answer, 0)
})

test('rejects invalid user input before contacting the model', async () => {
  for (const invalid of [{count: 0}, {count: 11}, {count: 1.5}, {count: '3'}, {material: ''}, {topic: ' '}, {cognitiveLevel: 'C7'}]) {
    await assert.rejects(generateQuestions({...example.request, ...invalid}, {...options, fetch: () => assert.fail('Invalid input reached model API')}), {status: 400})
  }
  await assert.rejects(generateQuestions(example.request, {provider: 'openai', apiKey: ''}), {status: 503, code: 'AI_NOT_CONFIGURED'})
})

test('handles API access, quota, provider errors, network failures and timeouts', async () => {
  for (const [status, code] of [[401, 'AI_ACCESS_DENIED'], [403, 'AI_ACCESS_DENIED'], [429, 'AI_RATE_LIMITED'], [503, 'AI_UNAVAILABLE'], [500, 'AI_PROVIDER_ERROR']]) {
    await assert.rejects(generateQuestions(example.request, {...options, fetch: async () => new Response('', {status})}), {code})
  }
  await assert.rejects(generateQuestions(example.request, {...options, fetch: async () => {throw new TypeError('fetch failed')}}), {code: 'AI_CONNECTION_ERROR'})
  await assert.rejects(generateQuestions(example.request, {...options, fetch: async () => {throw new DOMException('timeout', 'TimeoutError')}}), {code: 'AI_TIMEOUT'})
})

test('handles refusal, incomplete output and malformed provider responses', async () => {
  for (const [body, code] of [
    [{status: 'completed', output: [{type: 'message', content: [{type: 'refusal', refusal: 'no'}]}]}, 'AI_REFUSAL'],
    [{status: 'incomplete', output: []}, 'AI_INCOMPLETE'],
    [{status: 'completed', output: []}, 'AI_INVALID_OUTPUT'],
    [{status: 'completed', output: {}}, 'AI_INVALID_OUTPUT'],
    [{status: 'completed', output: [{type: 'message', content: [null, {type: 'output_text', text: {}}]}]}, 'AI_INVALID_OUTPUT'],
    [null, 'AI_INCOMPLETE'],
  ]) {
    await assert.rejects(generateQuestions(example.request, {...options, fetch: async () => Response.json(body)}), {code})
  }
})

const geminiResponse = (value) => Response.json({
  status: 'completed',
  steps: [
    {type: 'thought', signature: 'ignored-test-signature'},
    {type: 'model_output', content: [{type: 'text', text: JSON.stringify(value)}]},
  ],
})
const geminiOptions = {provider: 'gemini', apiKey: 'gemini-test-key', model: 'gemini-4-hydrogen'}

test('Gemini uses its API key header and JSON Schema and returns the same three editor drafts', async () => {
  const result = await generateQuestions(example.request, {...geminiOptions, fetch: async (url, request) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions')
    assert.equal(request.headers['x-goog-api-key'], 'gemini-test-key')
    assert.equal(request.headers['Api-Revision'], '2026-05-20')
    assert.equal(request.headers.Authorization, undefined)
    assert(!url.includes('gemini-test-key'))
    assert(request.signal instanceof AbortSignal)
    const body = JSON.parse(request.body)
    assert.equal(body.store, false)
    assert.equal(body.model, 'gemini-4-hydrogen')
    assert.match(body.system_instruction, /C3/)
    assert.deepEqual(JSON.parse(body.input), {material: input.material, topic: input.topic})
    assert.equal(body.response_format.mime_type, 'application/json')
    assert.equal(body.response_format.schema.type, 'object')
    assert(body.generation_config.max_output_tokens > 0)
    return geminiResponse(example.response)
  }})
  assert.deepEqual(result, example.response)
  assert.equal(generatedQuestionFields(result.questions[2], 'Basis Data').answer, 2)
})

test('Gemini respects environment selection and keeps each provider key and model separate', async (context) => {
  const keys = ['AI_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL']
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  context.after(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  })
  Object.assign(process.env, {
    AI_PROVIDER: ' Gemini ', GEMINI_API_KEY: 'gemini-environment-key', GEMINI_MODEL: 'gemini-custom-model',
    OPENAI_API_KEY: 'openai-environment-key', OPENAI_MODEL: 'openai-custom-model',
  })
  const fetch = async (_url, request) => {
    assert.equal(request.headers['x-goog-api-key'], 'gemini-environment-key')
    assert.equal(JSON.parse(request.body).model, 'gemini-custom-model')
    return geminiResponse(example.response)
  }
  assert.equal((await generateQuestions(example.request, {fetch})).questions.length, 3)
  delete process.env.GEMINI_API_KEY
  await assert.rejects(generateQuestions(example.request, {fetch: () => assert.fail('Missing Gemini key should not fall back to another provider')}), {code: 'AI_NOT_CONFIGURED'})
  delete process.env.GEMINI_MODEL
  await generateQuestions(example.request, {apiKey: 'gemini-override', fetch: async (_url, request) => {
    assert.equal(JSON.parse(request.body).model, 'gemini-4-hydrogen')
    return geminiResponse(example.response)
  }})
})

test('Gemini shares validation for incomplete batches and invalid answer keys', async () => {
  const incomplete = {questions: example.response.questions.slice(0, 2)}
  await assert.rejects(generateQuestions(example.request, {...geminiOptions, fetch: async () => geminiResponse(incomplete)}), {code: 'AI_INVALID_OUTPUT'})
  const invalid = structuredClone(example.response)
  invalid.questions[0].correctOptionId = 'E'
  await assert.rejects(generateQuestions(example.request, {...geminiOptions, fetch: async () => geminiResponse(invalid)}), {code: 'AI_INVALID_OUTPUT'})
})

test('Gemini handles quota, invalid keys, provider failures and timeouts', async () => {
  for (const [status, code] of [[401, 'AI_ACCESS_DENIED'], [403, 'AI_ACCESS_DENIED'], [429, 'AI_RATE_LIMITED'], [400, 'AI_PROVIDER_ERROR'], [503, 'AI_UNAVAILABLE']]) {
    await assert.rejects(generateQuestions(example.request, {...geminiOptions, fetch: async () => Response.json({error: {message: 'test-provider-error'}}, {status})}), {code})
  }
  for (const reason of ['API_KEY_INVALID', 'API_KEY_EXPIRED']) {
    await assert.rejects(generateQuestions(example.request, {...geminiOptions, fetch: async () => Response.json({error: {details: [{reason}]}}, {status: 400})}), {code: 'AI_ACCESS_DENIED'})
  }
  await assert.rejects(generateQuestions(example.request, {...geminiOptions, fetch: async () => {throw new DOMException('timeout', 'TimeoutError')}}), {code: 'AI_TIMEOUT'})
})

test('Gemini rejects unfinished, malformed and failed interactions', async () => {
  for (const [body, code] of [
    [{status: 'incomplete', steps: []}, 'AI_INCOMPLETE'],
    [{status: 'failed', error: {message: 'test-only-provider-failure'}}, 'AI_PROVIDER_ERROR'],
    [{status: 'completed', steps: []}, 'AI_INVALID_OUTPUT'],
    [{status: 'completed', steps: {}}, 'AI_INVALID_OUTPUT'],
    [{status: 'completed', steps: [{type: 'model_output', content: [null, {type: 'text', text: {}}]}]}, 'AI_INVALID_OUTPUT'],
    [null, 'AI_INCOMPLETE'],
  ]) {
    await assert.rejects(generateQuestions(example.request, {...geminiOptions, fetch: async () => Response.json(body)}), {code})
  }
})

test('unknown provider is rejected before any credentials are sent', async () => {
  await assert.rejects(generateQuestions(example.request, {...options, provider: 'unknown', fetch: () => assert.fail('Unexpected provider request')}), {code: 'AI_INVALID_CONFIG'})
})

test('topic mode generates three questions without source material on either provider', async () => {
  const request = {...example.request, mode: 'topic'}
  delete request.material
  const normalized = generationInput(request)
  assert.equal(normalized.mode, 'topic')
  assert.equal(normalized.material, '')
  for (const provider of ['openai', 'gemini']) {
    const result = await generateQuestions(request, {provider, apiKey: 'topic-test-key', fetch: async (_url, init) => {
      const body = JSON.parse(init.body)
      assert.deepEqual(JSON.parse(body.input), {course: request.course, topic: request.topic})
      const prompt = body.instructions ?? body.system_instruction
      assert.match(prompt, /pengetahuan umum akademik/)
      assert(!prompt.includes('Gunakan hanya informasi yang didukung materi'))
      return provider === 'gemini' ? geminiResponse(example.response) : response(example.response)
    }})
    assert.equal(result.questions.length, 3)
    assert.equal(generatedQuestionFields(result.questions[0], request.course).answer, 0)
  }
})

test('topic mode excludes material retained from a previous material-mode form', async () => {
  await generateQuestions({...example.request, mode: 'topic', material: 'MATERI_LAMA_PRIBADI'}, {...geminiOptions, fetch: async (_url, init) => {
    assert(!init.body.includes('MATERI_LAMA_PRIBADI'))
    assert.equal(JSON.parse(JSON.parse(init.body).input).material, undefined)
    return geminiResponse(example.response)
  }})
})

test('legacy requests still require material and unknown generation modes are rejected', () => {
  assert.equal(generationInput(example.request).mode, 'material')
  assert.equal(generationInput({...example.request, mode: 'material'}).material, example.request.material)
  for (const invalid of [{material: ''}, {material: undefined}, {mode: 'unknown'}, {mode: 'topic', topic: ' '}]) {
    assert.throws(() => generationInput({...example.request, ...invalid}), {status: 400})
  }
})
