/**
 * The calm page shown for a paused or expired account page. The proxy sends
 * it with status 410; the route renders the same words if it is reached.
 */
export const GONE_TITLE = 'This page is no longer available'
export const GONE_BODY = 'Contact your Hoverline representative.'

export function goneHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${GONE_TITLE} | Hoverline</title>
<style>
  :root { color-scheme: light dark; --bg: #edf0ec; --fg: #14233a; --muted: #4a5768; --line: #c9cfc8; --accent: #b4246b; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0f1b2b; --fg: #e4e8e2; --muted: #a7b0b8; --line: #2b3b50; --accent: #e0569a; } }
  html { background: var(--bg); color: var(--fg); font: 17px/1.6 ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; }
  header { border-bottom: 1px solid var(--line); padding: 14px 16px; font-weight: 700; letter-spacing: -0.01em; }
  header a { color: inherit; text-decoration: none; }
  main { max-width: 40rem; padding: 18vh 16px 4rem; margin: 0 auto; }
  h1 { font-size: 1.66rem; line-height: 1.3; margin: 0; }
  p { color: var(--muted); margin: 0.75rem 0 0; }
  a.home { display: inline-block; margin-top: 1.5rem; color: var(--fg); text-underline-offset: 4px; }
  a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
</style>
</head>
<body>
<header><a href="/">Hoverline</a></header>
<main>
<h1>${GONE_TITLE}.</h1>
<p>${GONE_BODY}</p>
<a class="home" href="/">Go to the Hoverline site</a>
</main>
</body>
</html>`
}
