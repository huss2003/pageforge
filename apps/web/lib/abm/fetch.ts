import { lookup as dnsLookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import zlib from 'node:zlib'
import { safeErrorMessage } from '@/lib/env'
import { checkIp, isIpLiteral } from './net'

/**
 * Public-page fetcher for account sources (spec §5, security-critical).
 *
 * - http(s) only, no credentials in the URL, ports 80/443 only.
 * - DNS is resolved here and every address is checked against private,
 *   loopback, link-local, CGNAT, ULA, multicast and metadata ranges (IPv4
 *   and IPv6, including IPv4-mapped IPv6). The connection is then pinned to
 *   the checked address, so a second DNS answer cannot redirect it.
 * - Redirects are followed by hand (max 3) and every hop is re-checked.
 * - 8 s timeout, 1.5 MB cap (after decompression), text/html only.
 *
 * Loopback (and any port on it) is allowed only when `allowLoopback` is set:
 * outside production, or with ABM_ALLOW_LOCAL_SOURCES=1, for local demos.
 */
export const USER_AGENT = 'PageForgeBot/1.0 (+https://github.com/huss2003/pageforge)'
export const FETCH_TIMEOUT_MS = 8_000
export const MAX_BYTES = 1_500_000
export const MAX_REDIRECTS = 3

export interface RawResponse {
  status: number
  headers: Record<string, string | undefined>
  body: string
}

export interface FetchDeps {
  /** Resolve a hostname to every address it has. */
  resolve: (hostname: string) => Promise<string[]>
  /** GET `url`, connecting to `address` (already checked). */
  request: (
    url: URL,
    address: string,
    opts: { timeoutMs: number; maxBytes: number },
  ) => Promise<RawResponse>
}

export type FetchFailure = 'blocked' | 'failed'

export class SourceFetchError extends Error {
  constructor(
    readonly kind: FetchFailure,
    message: string,
  ) {
    super(message)
    this.name = 'SourceFetchError'
  }
}

export interface SafeFetchOptions {
  allowLoopback?: boolean
  /** Accept text/plain too (robots.txt). Default: text/html only. */
  accept?: 'html' | 'text'
  deps?: Partial<FetchDeps>
}

export interface SafeFetchResult {
  url: string
  status: number
  contentType: string
  body: string
}

export const defaultDeps: FetchDeps = {
  resolve: async (hostname) =>
    (await dnsLookup(hostname, { all: true, verbatim: true })).map((a) => a.address),
  request: nodeRequest,
}

/** Check a URL's shape: protocol, credentials, port. Returns the parsed URL. */
export function checkUrl(raw: string, allowLoopback = false): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new SourceFetchError('blocked', 'Not a valid URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new SourceFetchError('blocked', 'Only http and https URLs can be fetched.')
  if (url.username || url.password)
    throw new SourceFetchError('blocked', 'URLs with a user name or password are not fetched.')
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
  if (port !== 80 && port !== 443 && !allowLoopback)
    throw new SourceFetchError('blocked', `Port ${port} is not allowed; only 80 and 443.`)
  return url
}

/** Resolve a host and check every address. Returns the address to connect to. */
export async function resolveSafe(
  url: URL,
  opts: { allowLoopback?: boolean; resolve: FetchDeps['resolve'] },
): Promise<string> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  let addresses: string[]
  if (isIpLiteral(host)) addresses = [host]
  else {
    try {
      addresses = await opts.resolve(host)
    } catch (e) {
      throw new SourceFetchError(
        'failed',
        `DNS lookup failed for ${host}: ${safeErrorMessage(e, 120)}`,
      )
    }
  }
  if (!addresses.length) throw new SourceFetchError('failed', `${host} has no address.`)
  let allLoopback = true
  for (const a of addresses) {
    const v = checkIp(a)
    if (v.loopback && opts.allowLoopback) continue
    allLoopback = false
    if (v.blocked)
      throw new SourceFetchError(
        'blocked',
        `${host} resolves to a ${v.reason} address, which is never fetched.`,
      )
  }
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
  if (port !== 80 && port !== 443 && !allLoopback)
    throw new SourceFetchError('blocked', `Port ${port} is not allowed; only 80 and 443.`)
  return addresses[0]!
}

/** Fetch one public page with every SSRF check (see module comment). */
export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const deps: FetchDeps = { ...defaultDeps, ...opts.deps }
  let url = checkUrl(rawUrl, opts.allowLoopback)
  for (let hop = 0; ; hop++) {
    const address = await resolveSafe(url, {
      allowLoopback: opts.allowLoopback,
      resolve: deps.resolve,
    })
    let res: RawResponse
    try {
      res = await deps.request(url, address, { timeoutMs: FETCH_TIMEOUT_MS, maxBytes: MAX_BYTES })
    } catch (e) {
      if (e instanceof SourceFetchError) throw e
      throw new SourceFetchError(
        'failed',
        `Could not fetch ${url.href}: ${safeErrorMessage(e, 160)}`,
      )
    }
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      if (hop >= MAX_REDIRECTS)
        throw new SourceFetchError('failed', `More than ${MAX_REDIRECTS} redirects.`)
      let next: string
      try {
        next = new URL(res.headers.location, url).href
      } catch {
        throw new SourceFetchError('failed', 'Redirect to an invalid URL.')
      }
      url = checkUrl(next, opts.allowLoopback)
      continue
    }
    const contentType = (res.headers['content-type'] ?? '').toLowerCase()
    if (res.status < 200 || res.status >= 300)
      throw new SourceFetchError('failed', `${url.href} answered HTTP ${res.status}.`)
    const okType =
      contentType.includes('text/html') ||
      contentType.includes('application/xhtml+xml') ||
      (opts.accept === 'text' && contentType.includes('text/plain'))
    if (!okType)
      throw new SourceFetchError(
        'failed',
        `${url.href} is ${contentType.split(';')[0] || 'an unknown type'}, not an HTML page.`,
      )
    return { url: url.href, status: res.status, contentType, body: res.body }
  }
}

/** node:http(s) GET pinned to a checked address, with timeout and size cap. */
function nodeRequest(url: URL, address: string, opts: { timeoutMs: number; maxBytes: number }) {
  return new Promise<RawResponse>((resolve, reject) => {
    const family = isIP(address) === 6 ? 6 : 4
    const mod = url.protocol === 'https:' ? https : http
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    const req = mod.request(
      {
        protocol: url.protocol,
        hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5',
          'accept-encoding': 'gzip, deflate, br',
        },
        servername: isIpLiteral(hostname) ? undefined : hostname,
        // Pin the connection to the address we checked.
        lookup: ((_h: string, o: { all?: boolean }, cb: (...a: unknown[]) => void) => {
          if (o?.all) cb(null, [{ address, family }])
          else cb(null, address, family)
        }) as never,
      },
      (res) => {
        const headers: Record<string, string | undefined> = {}
        for (const [k, v] of Object.entries(res.headers))
          headers[k] = Array.isArray(v) ? v.join(', ') : v
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400) {
          res.resume()
          resolve({ status, headers, body: '' })
          return
        }
        const enc = (headers['content-encoding'] ?? '').toLowerCase()
        const stream =
          enc === 'gzip'
            ? res.pipe(zlib.createGunzip())
            : enc === 'deflate'
              ? res.pipe(zlib.createInflate())
              : enc === 'br'
                ? res.pipe(zlib.createBrotliDecompress())
                : res
        const chunks: Buffer[] = []
        let size = 0
        stream.on('data', (c: Buffer) => {
          size += c.length
          if (size > opts.maxBytes) {
            req.destroy()
            reject(new SourceFetchError('failed', `${url.href} is larger than 1.5 MB.`))
            return
          }
          chunks.push(c)
        })
        stream.on('end', () => {
          const charset = /charset=([\w-]+)/i.exec(headers['content-type'] ?? '')?.[1] ?? 'utf-8'
          let body: string
          try {
            body = new TextDecoder(charset).decode(Buffer.concat(chunks))
          } catch {
            body = Buffer.concat(chunks).toString('utf8')
          }
          resolve({ status, headers, body })
        })
        stream.on('error', reject)
      },
    )
    req.setTimeout(opts.timeoutMs, () => {
      req.destroy(new SourceFetchError('failed', `${url.href} did not answer within 8 s.`))
    })
    const timer = setTimeout(
      () => req.destroy(new SourceFetchError('failed', `${url.href} did not finish within 8 s.`)),
      opts.timeoutMs,
    )
    req.on('close', () => clearTimeout(timer))
    req.on('error', reject)
    req.end()
  })
}
