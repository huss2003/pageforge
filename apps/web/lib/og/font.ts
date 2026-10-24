import 'server-only'

/**
 * Loads Archivo Expanded ExtraBold for Open Graph images.
 *
 * Satori needs a TTF/OTF/WOFF buffer, so we ask the Google Fonts CSS API for
 * the exact glyphs in the image (`text=`), which returns a small truetype
 * subset. If the network is unavailable (offline build, firewall) we return
 * null and the image renders with the built-in fallback font.
 */
export async function loadArchivo(text: string): Promise<ArrayBuffer | null> {
  const glyphs = Array.from(new Set(text)).join('')
  const cssUrl = `https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,800&text=${encodeURIComponent(glyphs)}`
  try {
    const css = await fetch(cssUrl, { signal: AbortSignal.timeout(4000) }).then((r) =>
      r.ok ? r.text() : Promise.reject(new Error(`fonts css ${r.status}`)),
    )
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype|woff)'\)/)?.[1]
    if (!src) throw new Error('no truetype source in font css')
    const font = await fetch(src, { signal: AbortSignal.timeout(4000) })
    if (!font.ok) throw new Error(`font file ${font.status}`)
    return await font.arrayBuffer()
  } catch (error) {
    console.warn('[og] Archivo unavailable, using fallback font:', (error as Error).message)
    return null
  }
}
