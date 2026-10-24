/**
 * Built-in demo calendar (spec §6): the next 10 working days, 30-minute
 * slots from 10:00 to 17:00 in Asia/Kolkata and in US Eastern. Slots are
 * returned as UTC ISO strings; the UI shows them in the visitor's time zone.
 */
export const SLOT_ZONES = ['Asia/Kolkata', 'America/New_York'] as const
export const WORKING_DAYS = 10
export const SLOT_MINUTES = 30
/** No slot closer than this to "now". */
export const LEAD_TIME_MS = 2 * 60 * 60 * 1000

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number // 0 = Sunday
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function localParts(ms: number, timeZone: string): LocalParts {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    })
    formatters.set(timeZone, f)
  }
  const parts = Object.fromEntries(f.formatToParts(new Date(ms)).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday ?? ''),
  }
}

/** UTC ms for a wall-clock time in a time zone (DST-safe for whole and half hours). */
export function zonedToUtc(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  timeZone: string,
): number {
  const wall = Date.UTC(y, m - 1, d, h, min)
  const offsetAt = (ms: number) => {
    const p = localParts(ms, timeZone)
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60000) * 60000
  }
  let t = wall - offsetAt(wall)
  t = wall - offsetAt(t)
  return t
}

export function availableSlots(now: Date, booked: string[] = []): string[] {
  const taken = new Set(booked.map((b) => Date.parse(b)))
  const earliest = now.getTime() + LEAD_TIME_MS
  const out = new Set<number>()
  for (const zone of SLOT_ZONES) {
    const today = localParts(now.getTime(), zone)
    let found = 0
    for (let offset = 0; found < WORKING_DAYS && offset < 21; offset++) {
      const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset))
      const weekday = date.getUTCDay()
      if (weekday === 0 || weekday === 6) continue
      found++
      for (let minutes = 10 * 60; minutes < 17 * 60; minutes += SLOT_MINUTES) {
        const t = zonedToUtc(
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          date.getUTCDate(),
          Math.floor(minutes / 60),
          minutes % 60,
          zone,
        )
        if (t >= earliest && !taken.has(t)) out.add(t)
      }
    }
  }
  return [...out].sort((a, b) => a - b).map((t) => new Date(t).toISOString())
}

/** True when `slotStart` is one of the offered slots right now. */
export function isOfferedSlot(slotStart: string, now: Date, booked: string[] = []): string | null {
  const t = Date.parse(slotStart)
  if (!Number.isFinite(t)) return null
  const iso = new Date(t).toISOString()
  return availableSlots(now, booked).includes(iso) ? iso : null
}
