import type { Metadata } from 'next'
import { PreviewCanvas } from '@/components/abm/preview-canvas'

export const metadata: Metadata = { title: 'Preview' }

/** Rendered inside the desk's preview iframe; the desk posts the page to it. */
export default function PreviewPage() {
  return <PreviewCanvas />
}
