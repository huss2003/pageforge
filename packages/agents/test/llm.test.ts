import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  FallbackLlm,
  FakeLlm,
  GeminiClient,
  GroqClient,
  LlmError,
  createLlmFromEnv,
  extractJson,
  geminiSchema,
  type FetchLike,
} from '../src'
import { facts } from '@pageforge/content'

const schema = z.object({ answer: z.string().max(20) })
const call = { system: 'sys', prompt: 'p', schema, task: 'test' }

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

const geminiOk = (text: string) =>
  json({
    candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 3 },
  })

const groqOk = (text: string) =>
  json({
    choices: [{ message: { content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 20, completion_tokens: 7 },
  })

/** Routes requests by host; records every call. */
function mockFetch(handlers: {
  gemini?: () => Response | Promise<Response>
  groq?: () => Response | Promise<Response>
}) {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] =
    []
  const fn = vi.fn<FetchLike>(async (url, init) => {
    calls.push({
      url,
      body: JSON.parse(String(init?.body)),
      headers: init?.headers as Record<string, string>,
    })
    if (url.includes('generativelanguage') && handlers.gemini) return handlers.gemini()
    if (url.includes('groq.com') && handlers.groq) return handlers.groq()
    throw new Error(`unexpected ${url}`)
  })
  return { fetch: fn, calls }
}

describe('GeminiClient', () => {
  it('sends a JSON response schema and returns usage', async () => {
    const m = mockFetch({ gemini: () => geminiOk('{"answer":"yes"}') })
    const llm = new GeminiClient({ apiKey: 'k', model: 'gemini-3.8-flash', fetch: m.fetch })
    const res = await llm.generateJson(call)
    expect(res).toEqual({
      data: { answer: 'yes' },
      model: 'gemini-3.8-flash',
      tokens: { input: 12, output: 8 },
    })
    const { url, body, headers } = m.calls[0]!
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    )
    expect(headers['x-goog-api-key']).toBe('k')
    const config = body.generationConfig as Record<string, any>
    expect(config.responseFormat.text.mimeType).toBe('APPLICATION_JSON')
    expect(config.responseFormat.text.schema.properties.answer).toEqual({ type: 'string' })
    expect(config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' })
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'sys' }] })
  })

  it('leaves Flash-Lite on its default thinking and skips the schema when unconstrained', async () => {
    const m = mockFetch({ gemini: () => geminiOk('{"answer":"yes"}') })
    const llm = new GeminiClient({ apiKey: 'k', model: 'gemini-3.5-flash-lite', fetch: m.fetch })
    await llm.generateJson({ ...call, constrained: false })
    const config = m.calls[0]!.body.generationConfig as Record<string, unknown>
    expect(config.thinkingConfig).toBeUndefined()
    expect(config.responseFormat).toBeUndefined()
    expect(config.responseMimeType).toBe('application/json')
  })

  it('retries in plain JSON mode after a server error on the constrained call', async () => {
    let n = 0
    const m = mockFetch({
      gemini: () =>
        n++ === 0 ? json({ error: { message: 'internal' } }, 500) : geminiOk('{"answer":"ok"}'),
    })
    const res = await new GeminiClient({ apiKey: 'k', fetch: m.fetch }).generateJson(call)
    expect(res.data.answer).toBe('ok')
    expect(m.calls).toHaveLength(2)
  })

  it('falls back to plain JSON mode when the schema is rejected', async () => {
    let n = 0
    const m = mockFetch({
      gemini: () =>
        n++ === 0
          ? json({ error: { message: 'schema too complex' } }, 400)
          : geminiOk('```json\n{"answer":"ok"}\n```'),
    })
    const res = await new GeminiClient({ apiKey: 'k', fetch: m.fetch }).generateJson(call)
    expect(res.data.answer).toBe('ok')
    expect((m.calls[1]!.body.generationConfig as Record<string, unknown>).responseMimeType).toBe(
      'application/json',
    )
  })

  it('maps 429 to a rate-limit error with retry delay', async () => {
    const m = mockFetch({
      gemini: () =>
        json(
          { error: { code: 429, message: 'Quota exceeded', details: [{ retryDelay: '17s' }] } },
          429,
        ),
    })
    const err = await new GeminiClient({ apiKey: 'k', fetch: m.fetch })
      .generateJson(call)
      .catch((e) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect(err).toMatchObject({ kind: 'rate-limit', status: 429, retryAfterMs: 17_000 })
  })

  it('reports a schema mismatch with zod issues', async () => {
    const m = mockFetch({ gemini: () => geminiOk('{"answer":"' + 'x'.repeat(30) + '"}') })
    const err = await new GeminiClient({ apiKey: 'k', fetch: m.fetch })
      .generateJson(call)
      .catch((e) => e)
    expect(err).toMatchObject({
      kind: 'schema',
      issues: ['answer: Too big: expected string to have <=20 characters'],
    })
  })

  it('times out via AbortSignal', async () => {
    const slow: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
      })
    const err = await new GeminiClient({ apiKey: 'k', fetch: slow, timeoutMs: 20 })
      .generateJson(call)
      .catch((e) => e)
    expect(err).toMatchObject({ kind: 'timeout' })
  })
})

describe('geminiSchema', () => {
  it('rewrites const/oneOf and drops unsupported keywords', () => {
    const out = geminiSchema({
      type: 'object',
      properties: {
        t: { const: 'hero' },
        u: { oneOf: [{ type: 'string', maxLength: 3 }] },
        d: { type: 'string', default: 'x' },
      },
    })
    expect(out).toEqual({
      type: 'object',
      properties: {
        t: { enum: ['hero'] },
        u: { anyOf: [{ type: 'string' }] },
        d: { type: 'string' },
      },
    })
  })
})

describe('GroqClient', () => {
  it('uses JSON object mode and low reasoning effort for gpt-oss', async () => {
    const m = mockFetch({ groq: () => groqOk('{"answer":"g"}') })
    const res = await new GroqClient({ apiKey: 'gk', fetch: m.fetch }).generateJson(call)
    expect(res).toEqual({
      data: { answer: 'g' },
      model: 'openai/gpt-oss-120b',
      tokens: { input: 20, output: 7 },
    })
    const { body, headers } = m.calls[0]!
    expect(headers.authorization).toBe('Bearer gk')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.reasoning_effort).toBe('low')
    expect(body.include_reasoning).toBe(false)
  })
})

describe('FallbackLlm', () => {
  function pair(m: ReturnType<typeof mockFetch>) {
    return new FallbackLlm([
      new GeminiClient({ apiKey: 'a', fetch: m.fetch }),
      new GroqClient({ apiKey: 'b', fetch: m.fetch }),
    ])
  }

  it('switches to Groq when Gemini answers 429 and records the model', async () => {
    const m = mockFetch({
      gemini: () =>
        json({ error: { message: 'Resource exhausted' } }, 429, { 'retry-after': '30' }),
      groq: () => groqOk('{"answer":"from groq"}'),
    })
    const llm = pair(m)
    const res = await llm.generateJson(call)
    expect(res.data.answer).toBe('from groq')
    expect(res.model).toBe('openai/gpt-oss-120b')
    expect(llm.lastAttempts.map((a) => [a.provider, a.ok, a.kind])).toEqual([
      ['gemini', false, 'rate-limit'],
      ['groq', true, undefined],
    ])
    // Gemini is cooling down: the next call goes straight to Groq.
    await llm.generateJson(call)
    expect(m.calls.filter((c) => c.url.includes('generativelanguage'))).toHaveLength(1)
  })

  it('switches on 5xx and invalid JSON, but not on a schema mismatch', async () => {
    const m5 = mockFetch({
      gemini: () => json({ error: 'boom' }, 503),
      groq: () => groqOk('{"answer":"g"}'),
    })
    expect((await pair(m5).generateJson(call)).model).toBe('openai/gpt-oss-120b')

    const mj = mockFetch({
      gemini: () => geminiOk('not json at all'),
      groq: () => groqOk('{"answer":"g"}'),
    })
    expect((await pair(mj).generateJson(call)).model).toBe('openai/gpt-oss-120b')

    const ms = mockFetch({
      gemini: () => geminiOk('{"answer":1}'),
      groq: () => groqOk('{"answer":"g"}'),
    })
    await expect(pair(ms).generateJson(call)).rejects.toMatchObject({ kind: 'schema' })
    expect(ms.calls).toHaveLength(1)
  })

  it('throws the last error when every client fails', async () => {
    const m = mockFetch({ gemini: () => json({}, 500), groq: () => json({}, 429) })
    await expect(pair(m).generateJson(call)).rejects.toMatchObject({
      kind: 'rate-limit',
      provider: 'groq',
    })
  })
})

describe('createLlmFromEnv', () => {
  it('picks fallback, single or simulated clients from env', () => {
    const both = createLlmFromEnv({ GEMINI_API_KEY: 'a', GROQ_API_KEY: 'b' }, { facts })
    expect(both.llm).toBeInstanceOf(FallbackLlm)
    expect(both.models).toEqual(['gemini-3.5-flash-lite', 'openai/gpt-oss-120b'])
    expect(both.simulated).toBe(false)

    const one = createLlmFromEnv({ GROQ_API_KEY: 'b', GROQ_MODEL: 'qwen/qwen3.8-27b' }, { facts })
    expect(one.llm).toBeInstanceOf(GroqClient)
    expect(one.models).toEqual(['qwen/qwen3.8-27b'])

    const none = createLlmFromEnv({ GEMINI_API_KEY: '  ' }, { facts })
    expect(none.llm).toBeInstanceOf(FakeLlm)
    expect(none.simulated).toBe(true)
  })
})

describe('extractJson', () => {
  it('handles fences and surrounding prose', () => {
    expect(extractJson('Here you go:\n{"a":1}\nThanks')).toEqual({ a: 1 })
    expect(() => extractJson('nope')).toThrow()
  })
})
