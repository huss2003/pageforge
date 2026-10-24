import type { Meta, StoryObj } from '@storybook/react-vite'
import { DemoForm } from '../blocks/demo-form'
import { demoForm } from '../blocks/examples'
import type { DemoFormState } from '../blocks/types'

/** Simulates the site's server action: validates, waits, then succeeds. */
async function fakeAction(_prev: DemoFormState, formData: FormData): Promise<DemoFormState> {
  await new Promise((r) => setTimeout(r, 700))
  const fieldErrors: Record<string, string> = {}
  if (!String(formData.get('name') ?? '').trim()) fieldErrors.name = 'Enter your name.'
  const email = String(formData.get('email') ?? '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    fieldErrors.email = 'Enter a work email, like dana@operator.com.'
  if (!String(formData.get('company') ?? '').trim())
    fieldErrors.company = 'Enter the company that runs the site.'
  if (!formData.get('siteType')) fieldErrors.siteType = 'Choose the kind of site.'
  if (Object.keys(fieldErrors).length)
    return { status: 'error', message: 'Check the highlighted fields.', fieldErrors }
  return { status: 'success' }
}

/** Always returns errors, so the error state can be reviewed without typing. */
async function failingAction(): Promise<DemoFormState> {
  return {
    status: 'error',
    message: 'Check the highlighted fields.',
    fieldErrors: {
      email: 'Enter a work email, like dana@operator.com.',
      siteType: 'Choose the kind of site.',
    },
  }
}

async function succeedingAction(): Promise<DemoFormState> {
  return { status: 'success' }
}

const meta = {
  title: 'Blocks/Demo form',
  component: DemoForm,
} satisfies Meta<typeof DemoForm>

export default meta
type Story = StoryObj<typeof meta>

export const Connected: Story = {
  args: { ...demoForm, context: { demoFormAction: fakeAction } },
}

export const ConnectedDark: Story = {
  name: 'Connected (dark)',
  args: { ...demoForm, context: { demoFormAction: fakeAction } },
  globals: { theme: 'dark' },
}

export const NotConnected: Story = {
  name: 'Not connected (no action)',
  args: demoForm,
}

export const WithErrors: Story = {
  name: 'Errors after submit',
  args: { ...demoForm, context: { demoFormAction: failingAction } },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
  },
}

export const Success: Story = {
  name: 'Success after submit',
  args: { ...demoForm, context: { demoFormAction: succeedingAction } },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
  },
}
