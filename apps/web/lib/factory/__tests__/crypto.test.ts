import { describe, expect, it } from 'vitest'
import {
  previewPath,
  previewToken,
  readCookie,
  safeEqual,
  signAdminSession,
  verifyAdminSession,
  verifyPreviewToken,
} from '../crypto'

const runId = '5b0c2d1e-8f3a-4b6c-9d2e-1f0a3b4c5d6e'

describe('preview tokens', () => {
  it('verifies the token issued for a run', () => {
    const t = previewToken(runId, 'preview-secret')
    expect(verifyPreviewToken(runId, t, 'preview-secret')).toBe(true)
    expect(previewPath(runId, 'preview-secret')).toBe(`/preview/${runId}?t=${t}`)
  })

  it('rejects tokens for another run, another secret, tampered or missing', () => {
    const t = previewToken(runId, 'preview-secret')
    expect(verifyPreviewToken('00000000-0000-4000-8000-000000000000', t, 'preview-secret')).toBe(
      false,
    )
    expect(verifyPreviewToken(runId, t, 'other-secret')).toBe(false)
    expect(
      verifyPreviewToken(runId, t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'), 'preview-secret'),
    ).toBe(false)
    expect(verifyPreviewToken(runId, '', 'preview-secret')).toBe(false)
    expect(verifyPreviewToken(runId, null, 'preview-secret')).toBe(false)
  })

  it('is URL safe', () => {
    expect(previewToken(runId, 's')).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('admin session cookie', () => {
  const now = Date.parse('2026-10-24T10:00:00Z')

  it('round-trips a valid, unexpired session', () => {
    const v = signAdminSession(now + 60_000, 'session-secret')
    expect(verifyAdminSession(v, 'session-secret', now)).toBe(true)
  })

  it('rejects expired sessions', () => {
    const v = signAdminSession(now - 1, 'session-secret')
    expect(verifyAdminSession(v, 'session-secret', now)).toBe(false)
  })

  it('rejects a forged expiry or signature, a wrong secret, and junk', () => {
    const v = signAdminSession(now + 60_000, 'session-secret')
    const [, sig] = v.split('.')
    expect(verifyAdminSession(`${now + 9_999_999}.${sig}`, 'session-secret', now)).toBe(false)
    expect(verifyAdminSession(v, 'wrong-secret', now)).toBe(false)
    expect(verifyAdminSession(`${now + 60_000}.`, 'session-secret', now)).toBe(false)
    expect(verifyAdminSession('garbage', 'session-secret', now)).toBe(false)
    expect(verifyAdminSession('abc.def', 'session-secret', now)).toBe(false)
    expect(verifyAdminSession(undefined, 'session-secret', now)).toBe(false)
  })

  it('reads the cookie from a header', () => {
    expect(readCookie('a=1; pf_admin=123.abc; b=2', 'pf_admin')).toBe('123.abc')
    expect(readCookie('a=1', 'pf_admin')).toBeNull()
    expect(readCookie(null, 'pf_admin')).toBeNull()
  })
})

describe('safeEqual', () => {
  it('compares exactly', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })
})
