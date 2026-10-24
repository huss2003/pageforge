import { describe, expect, it } from 'vitest'
import { describeSlot, groupSlotsByDay } from '@/components/abm/slots'

const now = Date.parse('2026-10-26T00:00:00Z')
const slots = [
  '2026-10-27T04:30:00Z', // 10:00 Kolkata, 00:30 New York
  '2026-10-27T14:00:00Z', // 19:30 Kolkata, 10:00 New York
  '2026-10-27T20:00:00Z', // 01:30 Kolkata on the 28th, 16:00 New York
  '2026-10-27T05:00:00Z',
  '2026-10-25T05:00:00Z', // in the past
]

describe('groupSlotsByDay', () => {
  it('groups by the calendar day in the visitor zone', () => {
    const kolkata = groupSlotsByDay(slots, 'Asia/Kolkata', now)
    expect(kolkata.map((d) => d.key)).toEqual(['2026-10-27', '2026-10-28'])
    expect(kolkata[0]!.slots.map((s) => s.time)).toEqual(['10:00', '10:30', '19:30'])
    expect(kolkata[1]!.slots.map((s) => s.time)).toEqual(['01:30'])
    expect(kolkata[0]!.label).toBe('Tue 27 Oct')

    const ny = groupSlotsByDay(slots, 'America/New_York', now)
    expect(ny.map((d) => d.key)).toEqual(['2026-10-27'])
    expect(ny[0]!.slots.map((s) => s.time)).toEqual(['00:30', '01:00', '10:00', '16:00'])
  })

  it('drops past and duplicate slots and sorts the rest', () => {
    const days = groupSlotsByDay([...slots, slots[0]!], 'UTC', now)
    const all = days.flatMap((d) => d.slots.map((s) => s.iso))
    expect(all).toEqual([...new Set(all)].sort())
    expect(all).not.toContain('2026-10-25T05:00:00Z')
  })

  it('describes a slot with its zone', () => {
    expect(describeSlot('2026-10-27T14:00:00Z', 'America/New_York')).toBe(
      'Tuesday 27 October at 10:00 (America/New York)',
    )
  })
})
