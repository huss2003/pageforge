/**
 * IP range checks for the source fetcher (SSRF guard). Written out by hand
 * so every blocked range is visible and unit-tested, for IPv4, IPv6 and
 * IPv6 forms that embed an IPv4 address (mapped, compatible, NAT64, 6to4).
 */

export function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const out: number[] = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const n = Number(p)
    if (n > 255) return null
    out.push(n)
  }
  return out
}

/** 16 bytes, or null. Accepts "::", "::1", "::ffff:1.2.3.4", zone ids ("fe80::1%eth0"), brackets. */
export function parseIPv6(input: string): number[] | null {
  let ip = input.trim()
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1)
  const zone = ip.indexOf('%')
  if (zone !== -1) ip = ip.slice(0, zone)
  if (!ip.includes(':')) return null

  // Trailing dotted IPv4 ("::ffff:10.0.0.1") becomes two hex groups.
  const lastColon = ip.lastIndexOf(':')
  const tail = ip.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail)
    if (!v4) return null
    ip = `${ip.slice(0, lastColon + 1)}${((v4[0]! << 8) | v4[1]!).toString(16)}:${((v4[2]! << 8) | v4[3]!).toString(16)}`
  }

  const halves = ip.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - rest.length
  if (halves.length === 1 && head.length !== 8) return null
  if (halves.length === 2 && missing < 1) return null
  const groups = [...head, ...(halves.length === 2 ? Array(missing).fill('0') : []), ...rest]
  const bytes: number[] = []
  for (const gr of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(gr)) return null
    const n = parseInt(gr, 16)
    bytes.push(n >> 8, n & 0xff)
  }
  return bytes.length === 16 ? bytes : null
}

const inV4 = (b: number[], base: [number, number, number, number], bits: number) => {
  const ip = ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0
  const net = ((base[0] << 24) | (base[1] << 16) | (base[2] << 8) | base[3]) >>> 0
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ip & mask) === (net & mask)
}

/** Non-public IPv4 ranges (RFC 6890 special-purpose registry and friends). */
const V4_BLOCKED: [[number, number, number, number], number, string][] = [
  [[0, 0, 0, 0], 8, 'this network'],
  [[10, 0, 0, 0], 8, 'private'],
  [[100, 64, 0, 0], 10, 'carrier-grade NAT'],
  [[127, 0, 0, 0], 8, 'loopback'],
  [[169, 254, 0, 0], 16, 'link-local / cloud metadata'],
  [[172, 16, 0, 0], 12, 'private'],
  [[192, 0, 0, 0], 24, 'IETF protocol assignments'],
  [[192, 0, 2, 0], 24, 'documentation'],
  [[192, 88, 99, 0], 24, '6to4 relay'],
  [[192, 168, 0, 0], 16, 'private'],
  [[198, 18, 0, 0], 15, 'benchmarking'],
  [[198, 51, 100, 0], 24, 'documentation'],
  [[203, 0, 113, 0], 24, 'documentation'],
  [[224, 0, 0, 0], 4, 'multicast'],
  [[240, 0, 0, 0], 4, 'reserved'],
]

export interface IpVerdict {
  blocked: boolean
  reason?: string
  loopback?: boolean
}

export function checkIPv4(b: number[]): IpVerdict {
  for (const [base, bits, reason] of V4_BLOCKED) {
    if (inV4(b, base, bits)) return { blocked: true, reason, loopback: reason === 'loopback' }
  }
  return { blocked: false }
}

const startsWith = (b: number[], prefix: number[], bits: number) => {
  for (let i = 0; i < bits; i++) {
    const byte = i >> 3
    const bit = 7 - (i & 7)
    if (((b[byte]! >> bit) & 1) !== (((prefix[byte] ?? 0) >> bit) & 1)) return false
  }
  return true
}

const v6 = (s: string) => parseIPv6(s)!

const V6_BLOCKED: [number[], number, string][] = [
  [v6('100::'), 64, 'discard-only'],
  [v6('2001::'), 32, 'Teredo'],
  [v6('2001:db8::'), 32, 'documentation'],
  [v6('2001:10::'), 28, 'ORCHID'],
  [v6('fc00::'), 7, 'unique local (ULA)'],
  [v6('fe80::'), 10, 'link-local'],
  [v6('fec0::'), 10, 'site-local'],
  [v6('ff00::'), 8, 'multicast'],
]

export function checkIPv6(b: number[]): IpVerdict {
  const zero = (from: number, to: number) => b.slice(from, to).every((x) => x === 0)
  if (zero(0, 16)) return { blocked: true, reason: 'unspecified' }
  if (zero(0, 15) && b[15] === 1) return { blocked: true, reason: 'loopback', loopback: true }
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d → judge the IPv4 address.
  if (zero(0, 10) && b[10] === 0xff && b[11] === 0xff) return mapped(b.slice(12))
  if (zero(0, 12)) return { blocked: true, reason: 'IPv4-compatible (deprecated)' }
  // NAT64 64:ff9b::/96 and 6to4 2002::/16 embed an IPv4 address.
  if (startsWith(b, v6('64:ff9b::'), 96)) return mapped(b.slice(12))
  if (startsWith(b, v6('64:ff9b:1::'), 48)) return { blocked: true, reason: 'local-use NAT64' }
  if (b[0] === 0x20 && b[1] === 0x02) return mapped(b.slice(2, 6))
  for (const [prefix, bits, reason] of V6_BLOCKED) {
    if (startsWith(b, prefix, bits)) return { blocked: true, reason }
  }
  return { blocked: false }
}

function mapped(v4: number[]): IpVerdict {
  const r = checkIPv4(v4)
  return r.blocked ? { ...r, reason: `${r.reason} (embedded IPv4)` } : r
}

/** Judge an IP address string; unparseable input is blocked. */
export function checkIp(ip: string): IpVerdict {
  const v4 = parseIPv4(ip)
  if (v4) return checkIPv4(v4)
  const b = parseIPv6(ip)
  if (b) return checkIPv6(b)
  return { blocked: true, reason: 'not an IP address' }
}

export function isIpLiteral(host: string): boolean {
  return Boolean(parseIPv4(host) || parseIPv6(host))
}
