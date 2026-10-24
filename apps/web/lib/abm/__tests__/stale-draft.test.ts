import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setAbmRuntime } from '../runtime'
import {
  createCampaign,
  getCampaignDetail,
  listAudit,
  startDraft,
  STALE_DRAFT_MS,
} from '../service'
import type { AccountBrief } from '../types'
import { clearEnv, testRuntime } from './helpers'

const marketer = { workspace: 'main' as const, role: 'marketer' as const }

const brief: AccountBrief = {
  companyName: 'Stalled Harbour Co',
  companyUrl: 'https://example.test/',
  industry: 'ports',
  campaignType: 'demo',
  goal: 'book-meeting',
  painPoints: [],
  targetRole: 'Head of Security',
  sourceChannel: 'email',
}

beforeEach(() => clearEnv())
afterEach(() => setAbmRuntime(null))

describe('stale draft recovery', () => {
  it('keeps a fresh draft generating, then resets one the platform cut off', async () => {
    const { advance } = testRuntime()
    const { id: campaignId } = await createCampaign(marketer, brief)
    // The background task is never drained: as if the function was stopped.
    await startDraft(marketer, campaignId)

    expect((await getCampaignDetail(marketer, campaignId)).status).toBe('generating')

    advance(STALE_DRAFT_MS + 1000)
    const detail = await getCampaignDetail(marketer, campaignId)
    expect(detail.status).toBe('draft')
    expect(detail.current).toBeNull()
    expect(detail.versions).toHaveLength(0)

    const audit = await listAudit(marketer, campaignId)
    expect(audit.some((a) => a.action === 'draft.failed' && a.actorRole === 'system')).toBe(true)

    // The marketer can start again.
    await expect(startDraft(marketer, campaignId)).resolves.toHaveProperty('versionId')
  })
})
