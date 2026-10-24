import { afterEach, describe, expect, it } from 'vitest'
import { redactSecrets, safeErrorMessage, secretEnv } from '@/lib/env'

const saved = { ...process.env }
afterEach(() => {
  process.env = { ...saved }
})

describe('secretEnv', () => {
  it('removes whitespace a wrapped paste added inside the value', () => {
    process.env.SUPABASE_SECRET_KEY = '  sb_secret_abcDEF\n123_xyz  '
    expect(secretEnv('SUPABASE_SECRET_KEY')).toBe('sb_secret_abcDEF123_xyz')
  })

  it('returns null for unset or blank values', () => {
    delete process.env.GROQ_API_KEY
    expect(secretEnv('GROQ_API_KEY')).toBeNull()
    process.env.GROQ_API_KEY = ' \n '
    expect(secretEnv('GROQ_API_KEY')).toBeNull()
  })
})

describe('redactSecrets', () => {
  it('scrubs a configured secret, including each wrapped line of it', () => {
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_AAAAbbbb\nCCCCdddd1234'
    const msg =
      'TypeError: Headers.set: "sb_secret_AAAAbbbb\nCCCCdddd1234" is an invalid header value.'
    const out = redactSecrets(msg)
    expect(out).not.toContain('AAAAbbbb')
    expect(out).not.toContain('CCCCdddd1234')
    expect(out).toContain('[redacted]')
  })

  it('scrubs credential-shaped strings even when not configured', () => {
    const out = redactSecrets(
      'keys sb_secret_zzzzzzzzzzzz AIzaSyA1234567890abcdefghij gsk_abcdefghijklmnopqrstuv github_pat_11ABCDEFGHIJKLMNOPQRSTUV',
    )
    expect(out).toBe('keys [redacted] [redacted] [redacted] [redacted]')
  })

  it('safeErrorMessage keeps one redacted line', () => {
    process.env.GEMINI_API_KEY = 'gemini-secret-value-123'
    const m = safeErrorMessage(new Error('bad key gemini-secret-value-123\nstack line'))
    expect(m).toBe('bad key [redacted]')
  })
})
