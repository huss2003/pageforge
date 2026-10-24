import type { Metadata } from 'next'
import { BriefForm } from '@/components/abm/brief-form'

export const metadata: Metadata = { title: 'New account page' }

export default function NewBriefPage() {
  return <BriefForm />
}
