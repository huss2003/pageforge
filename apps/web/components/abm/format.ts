/** Formatting shared by the desk and the public account pages. Safe on client and server. */

export function formatInt(n: number): string {
  return n.toLocaleString('en-US')
}

/** Ratio (0–1) → "4.1%". One decimal below 10%, none above. */
export function formatRate(ratio: number): string {
  const pct = ratio * 100
  if (pct === 0) return '0%'
  return `${pct < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`
}

/** Percentage already in 0–100 → "75%". */
export function formatPercent(pct: number): string {
  return `${Math.round(pct)}%`
}

/** Durations for review metrics: "6 min 40 s", "1 h 12 min". */
export function formatMinutes(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  if (totalSec < 60) return `${totalSec} s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return sec ? `${min} min ${sec} s` : `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** m:ss for a running clock. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatRelative(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '–'
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'Yesterday' : `${d} days ago`
}

/** "24 Oct, 14:05" in the viewer's locale and time zone. */
export function formatDateTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

export function formatDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(new Date(iso))
}

/** Path + query of an absolute URL, for compact display. */
export function displayPath(url: string): string {
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}`
  } catch {
    return url
  }
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatInt(n)} ${n === 1 ? one : many}`
}
