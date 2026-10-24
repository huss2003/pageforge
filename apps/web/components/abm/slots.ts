/**
 * Groups ISO slot starts by calendar day in the visitor's time zone, so a
 * 10:00 Asia/Kolkata slot lands on the day it falls on locally.
 */
export interface SlotDay {
  /** YYYY-MM-DD in the target zone. */
  key: string
  /** "Mon 27 Oct" */
  label: string
  slots: { iso: string; time: string }[]
}

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    key: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: get('weekday'),
    day: String(Number(get('day'))),
    time: `${get('hour')}:${get('minute')}`,
  }
}

export function groupSlotsByDay(slots: string[], timeZone: string, now = Date.now()): SlotDay[] {
  const days = new Map<string, SlotDay>()
  const monthFmt = new Intl.DateTimeFormat('en-GB', { timeZone, month: 'short' })
  const sorted = [...new Set(slots)]
    .map((iso) => ({ iso, t: new Date(iso).getTime() }))
    .filter((s) => Number.isFinite(s.t) && s.t > now)
    .sort((a, b) => a.t - b.t)
  for (const { iso, t } of sorted) {
    const d = new Date(t)
    const p = partsIn(d, timeZone)
    let day = days.get(p.key)
    if (!day) {
      day = { key: p.key, label: `${p.weekday} ${p.day} ${monthFmt.format(d)}`, slots: [] }
      days.set(p.key, day)
    }
    day.slots.push({ iso, time: p.time })
  }
  return [...days.values()]
}

/** The visitor's IANA zone, or UTC when the runtime cannot tell. */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** "Thursday 30 October at 15:30 (Europe/London)" */
export function describeSlot(iso: string, timeZone: string): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
  return `${date} at ${partsIn(d, timeZone).time} (${timeZone.replace(/_/g, ' ')})`
}
