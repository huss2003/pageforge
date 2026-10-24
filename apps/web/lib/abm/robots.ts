/**
 * robots.txt parsing for the source fetcher. Matches the group for
 * "PageForgeBot" (case-insensitive) and falls back to "*". Rules use the
 * longest match; on a tie Allow wins (RFC 9309). `*` and `$` are supported.
 */
export const BOT_NAME = 'PageForgeBot'

export interface RobotsRule {
  allow: boolean
  path: string
}

export interface Robots {
  groups: { agents: string[]; rules: RobotsRule[] }[]
}

export function parseRobots(text: string): Robots {
  const groups: Robots['groups'] = []
  let current: Robots['groups'][number] | null = null
  let lastWasAgent = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
    } else if (key === 'allow' || key === 'disallow') {
      lastWasAgent = false
      if (!current) continue
      // An empty Disallow allows everything; skip it.
      if (!value) continue
      current.rules.push({ allow: key === 'allow', path: value })
    } else {
      lastWasAgent = false
    }
  }
  return { groups }
}

function ruleMatches(rulePath: string, path: string): boolean {
  const anchored = rulePath.endsWith('$')
  const body = anchored ? rulePath.slice(0, -1) : rulePath
  const re = new RegExp(
    `^${body
      .split('*')
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}${anchored ? '$' : ''}`,
  )
  return re.test(path)
}

/** True when `path` (pathname + search) may be fetched by PageForgeBot. */
export function robotsAllows(robots: Robots, path: string, agent = BOT_NAME): boolean {
  const name = agent.toLowerCase()
  const own = robots.groups.filter((g) => g.agents.some((a) => a !== '*' && name.includes(a)))
  const groups = own.length ? own : robots.groups.filter((g) => g.agents.includes('*'))
  const rules = groups.flatMap((g) => g.rules)
  let best: RobotsRule | null = null
  for (const r of rules) {
    if (!ruleMatches(r.path, path)) continue
    if (
      !best ||
      r.path.length > best.path.length ||
      (r.path.length === best.path.length && r.allow && !best.allow)
    )
      best = r
  }
  return best ? best.allow : true
}
