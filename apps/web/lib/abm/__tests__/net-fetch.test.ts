import { describe, expect, it } from 'vitest'
import { extractPage } from '../extract'
import { MAX_REDIRECTS, SourceFetchError, safeFetch, type FetchDeps } from '../fetch'
import { northstar } from '../fictional-data'
import { checkIp, parseIPv6 } from '../net'
import { parseRobots, robotsAllows } from '../robots'
import { fictionalHtml } from './helpers'

describe('IP range checks', () => {
  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '100.127.255.254',
    '127.0.0.1',
    '127.255.255.255',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '192.0.2.10',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
  ])('blocks IPv4 %s', (ip) => {
    expect(checkIp(ip).blocked).toBe(true)
  })

  it.each(['8.8.8.8', '93.184.216.34', '172.32.0.1', '100.128.0.1', '169.255.0.1', '11.0.0.1'])(
    'allows public IPv4 %s',
    (ip) => {
      expect(checkIp(ip).blocked).toBe(false)
    },
  )

  it.each([
    '::',
    '::1',
    '[::1]',
    'fe80::1%eth0',
    'fc00::1',
    'fd00:ec2::254',
    'fec0::1',
    'ff02::1',
    '2001:db8::1',
    '2001:0:4136:e378::1',
    '100::1',
    '::127.0.0.1',
  ])('blocks IPv6 %s', (ip) => {
    expect(checkIp(ip).blocked).toBe(true)
  })

  it.each([
    ['::ffff:127.0.0.1', 'loopback'],
    ['::ffff:7f00:1', 'loopback'],
    ['::ffff:169.254.169.254', 'link-local'],
    ['::ffff:10.0.0.1', 'private'],
    ['64:ff9b::a00:1', 'private'],
    ['2002:c0a8:0101::1', 'private'],
  ])('blocks IPv4 embedded in IPv6 %s', (ip, reason) => {
    const v = checkIp(ip)
    expect(v.blocked).toBe(true)
    expect(v.reason).toContain(reason)
  })

  it('allows public IPv6 and public mapped IPv4', () => {
    expect(checkIp('2606:4700:4700::1111').blocked).toBe(false)
    expect(checkIp('::ffff:8.8.8.8').blocked).toBe(false)
    expect(checkIp('64:ff9b::808:808').blocked).toBe(false)
  })

  it('parses IPv6 forms and rejects garbage', () => {
    expect(parseIPv6('::ffff:1.2.3.4')?.slice(10)).toEqual([0xff, 0xff, 1, 2, 3, 4])
    expect(parseIPv6('1:2:3:4:5:6:7:8:9')).toBeNull()
    expect(parseIPv6('1::2::3')).toBeNull()
    expect(checkIp('not-an-ip').blocked).toBe(true)
  })
})

function deps(
  routes: Record<string, { status: number; headers?: Record<string, string>; body?: string }>,
  dns: Record<string, string[]>,
) {
  const seen: { url: string; address: string }[] = []
  const d: FetchDeps = {
    resolve: async (h) => {
      if (!dns[h]) throw new Error(`ENOTFOUND ${h}`)
      return dns[h]!
    },
    request: async (url, address) => {
      seen.push({ url: url.href, address })
      const r = routes[url.href]
      if (!r) return { status: 404, headers: { 'content-type': 'text/html' }, body: '' }
      return {
        status: r.status,
        headers: { 'content-type': 'text/html', ...r.headers },
        body: r.body ?? '',
      }
    },
  }
  return { d, seen }
}

const PUBLIC = { 'example.test': ['93.184.216.34'], 'other.test': ['8.8.4.4'] }

describe('safeFetch', () => {
  it('fetches a public HTML page, pinned to the checked address', async () => {
    const { d, seen } = deps(
      { 'https://example.test/': { status: 200, body: '<p>Hello</p>' } },
      PUBLIC,
    )
    const r = await safeFetch('https://example.test/', { deps: d })
    expect(r.body).toBe('<p>Hello</p>')
    expect(seen).toEqual([{ url: 'https://example.test/', address: '93.184.216.34' }])
  })

  it('refuses non-http schemes, credentials and other ports', async () => {
    const { d } = deps({}, PUBLIC)
    await expect(safeFetch('file:///etc/passwd', { deps: d })).rejects.toThrow(
      /Only http and https/,
    )
    await expect(safeFetch('ftp://example.test/', { deps: d })).rejects.toThrow(
      /Only http and https/,
    )
    await expect(safeFetch('https://u:p@example.test/', { deps: d })).rejects.toThrow(/user name/)
    await expect(safeFetch('https://example.test:8443/', { deps: d })).rejects.toThrow(/Port 8443/)
  })

  it('refuses hosts that resolve to private or metadata addresses, even partly', async () => {
    const { d, seen } = deps(
      {},
      {
        ...PUBLIC,
        'internal.test': ['10.0.0.5'],
        'mixed.test': ['93.184.216.34', '169.254.169.254'],
        'v6.test': ['::ffff:127.0.0.1'],
      },
    )
    for (const u of [
      'http://internal.test/',
      'http://mixed.test/',
      'http://v6.test/',
      'http://127.0.0.1/',
      'http://[::1]/',
      'http://169.254.169.254/latest/meta-data/',
      'http://2130706433/',
    ]) {
      const err = await safeFetch(u, { deps: d }).catch((e) => e)
      expect(err, u).toBeInstanceOf(SourceFetchError)
      expect((err as SourceFetchError).kind, u).toBe('blocked')
    }
    expect(seen).toEqual([])
  })

  it('re-checks every redirect hop and stops after 3', async () => {
    const { d, seen } = deps(
      {
        'https://example.test/a': { status: 302, headers: { location: 'https://other.test/b' } },
        'https://other.test/b': { status: 301, headers: { location: 'http://internal.test/c' } },
      },
      { ...PUBLIC, 'internal.test': ['192.168.0.10'] },
    )
    const err = await safeFetch('https://example.test/a', { deps: d }).catch((e) => e)
    expect((err as SourceFetchError).kind).toBe('blocked')
    expect(seen.map((s) => s.url)).toEqual(['https://example.test/a', 'https://other.test/b'])

    const loop: Record<string, { status: number; headers: Record<string, string> }> = {}
    for (let i = 0; i <= MAX_REDIRECTS + 1; i++)
      loop[`https://example.test/${i}`] = { status: 302, headers: { location: `/${i + 1}` } }
    const { d: d2 } = deps(loop, PUBLIC)
    await expect(safeFetch('https://example.test/0', { deps: d2 })).rejects.toThrow(
      /More than 3 redirects/,
    )
  })

  it('accepts text/html only and reports HTTP errors', async () => {
    const { d } = deps(
      {
        'https://example.test/pdf': { status: 200, headers: { 'content-type': 'application/pdf' } },
        'https://example.test/500': { status: 500 },
      },
      PUBLIC,
    )
    await expect(safeFetch('https://example.test/pdf', { deps: d })).rejects.toThrow(
      /not an HTML page/,
    )
    await expect(safeFetch('https://example.test/500', { deps: d })).rejects.toThrow(/HTTP 500/)
  })

  it('allows loopback (any port) only when local sources are enabled', async () => {
    const { d } = deps(
      { 'http://localhost:3123/x': { status: 200, body: 'ok' } },
      { localhost: ['127.0.0.1', '::1'] },
    )
    await expect(safeFetch('http://localhost:3123/x', { deps: d })).rejects.toThrow(/Port 3123/)
    await expect(safeFetch('http://localhost/x', { deps: d })).rejects.toThrow(/loopback/)
    expect(
      (await safeFetch('http://localhost:3123/x', { deps: d, allowLoopback: true })).body,
    ).toBe('ok')
    // Loopback permission never extends to private networks.
    const { d: d3 } = deps({}, { 'internal.test': ['10.0.0.1'] })
    await expect(
      safeFetch('http://internal.test/', { deps: d3, allowLoopback: true }),
    ).rejects.toThrow(/private/)
  })

  it('enforces the size cap and timeout through the real transport', async () => {
    const http = await import('node:http')
    const server = http.createServer((rq, rs) => {
      if (rq.url === '/big') {
        rs.writeHead(200, { 'content-type': 'text/html' })
        rs.end('x'.repeat(1_600_000))
      } else {
        rs.writeHead(200, { 'content-type': 'text/html' })
        rs.end('<p>small</p>')
      }
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port
    try {
      const ok = await safeFetch(`http://localhost:${port}/small`, {
        allowLoopback: true,
        deps: { resolve: async () => ['127.0.0.1'] },
      })
      expect(ok.body).toBe('<p>small</p>')
      await expect(
        safeFetch(`http://localhost:${port}/big`, {
          allowLoopback: true,
          deps: { resolve: async () => ['127.0.0.1'] },
        }),
      ).rejects.toThrow(/larger than 1.5 MB/)
    } finally {
      server.close()
    }
  })
})

describe('robots.txt', () => {
  const robots = parseRobots(`# comment
User-agent: *
Disallow: /private
Allow: /private/press

User-agent: PageForgeBot
User-agent: OtherBot
Disallow: /news
Allow: /news/public$
Disallow: /*.pdf$
`)

  it('uses the PageForgeBot group over *', () => {
    expect(robotsAllows(robots, '/news')).toBe(false)
    expect(robotsAllows(robots, '/news/2026')).toBe(false)
    expect(robotsAllows(robots, '/news/public')).toBe(true)
    expect(robotsAllows(robots, '/news/public/x')).toBe(false)
    expect(robotsAllows(robots, '/report.pdf')).toBe(false)
    // The * group does not apply when a specific group matches.
    expect(robotsAllows(robots, '/private')).toBe(true)
  })

  it('falls back to * and picks the longest match, Allow on ties', () => {
    expect(robotsAllows(robots, '/private/x', 'SomeBot')).toBe(false)
    expect(robotsAllows(robots, '/private/press/1', 'SomeBot')).toBe(true)
    const tie = parseRobots('User-agent: *\nDisallow: /a\nAllow: /a')
    expect(robotsAllows(tie, '/a')).toBe(true)
  })

  it('allows everything for empty or empty-Disallow files', () => {
    expect(robotsAllows(parseRobots(''), '/x')).toBe(true)
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow:'), '/x')).toBe(true)
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow: /'), '/x')).toBe(false)
  })
})

describe('text extraction', () => {
  it('keeps readable sentences and drops nav, header, footer, scripts and the banner', () => {
    const html = fictionalHtml(northstar, '')
    const page = extractPage(html, 'https://example.test/fictional/northstar-port-authority')
    expect(page.title).toBe('Northstar Port Authority')
    expect(page.sentences).toContain(
      'Northstar Port Authority operates four container terminals and two cruise berths on the Halden estuary.',
    )
    expect(page.sentences).toContain(
      'The port handled 2.8 million TEU in 2025, up 6% on the previous year.',
    )
    const all = page.sentences.join(' ')
    expect(all).not.toMatch(/Ignore me|Fictional organisation|All rights reserved/)
    expect(page.links).toEqual([
      'https://example.test/fictional/northstar-port-authority/about',
      'https://example.test/fictional/northstar-port-authority/facilities',
      'https://example.test/fictional/northstar-port-authority/news',
    ])
  })

  it('picks at most 3 same-site links that look like about/news pages', () => {
    const html = `<a href="https://elsewhere.test/about">x</a><a href="/careers">Careers</a>
      <a href="/company">Company</a><a href="/sustainability">S</a><a href="/report.pdf">About PDF</a>
      <a href="/security">Security</a><a href="/projects">Projects</a><a href="mailto:a@b.c">about</a>`
    const page = extractPage(html, 'https://www.example.test/')
    expect(page.links).toEqual([
      'https://www.example.test/company',
      'https://www.example.test/sustainability',
      'https://www.example.test/security',
    ])
  })
})
