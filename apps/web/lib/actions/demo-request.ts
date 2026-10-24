'use server'

import { headers } from 'next/headers'
import type { DemoFormState } from '@pageforge/ui/blocks'
import { submitLead } from '@/lib/leads'

/** Server action wired into the DemoForm block via BlockRenderer context. */
export async function submitDemoRequest(
  _prev: DemoFormState,
  formData: FormData,
): Promise<DemoFormState> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || undefined
  let sourcePath: string | undefined
  try {
    const referer = h.get('referer')
    sourcePath = referer ? new URL(referer).pathname : undefined
  } catch {
    sourcePath = undefined
  }
  const token = formData.get('cf-turnstile-response')
  return submitLead(formData, {
    ip,
    sourcePath,
    turnstileToken: typeof token === 'string' ? token : undefined,
  })
}
