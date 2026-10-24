import type { Metadata, Viewport } from 'next'
import { Archivo } from 'next/font/google'
import { site, siteUrl } from '@/lib/site'
import './globals.css'

// One family, two widths: expanded for headlines, normal for text.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${site.name}: ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: site.name,
    description: site.description,
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EDF0EC' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1B2B' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="min-h-dvh bg-surface text-fg">{children}</body>
    </html>
  )
}
