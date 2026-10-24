import type { Block } from '@pageforge/blocks'

/**
 * CONTRACT STUB — replaced by the design-system build.
 *
 * `BlockRenderer` renders an ordered list of blocks. The site, the Factory
 * preview and Storybook all go through it, so every page shares one system.
 * Signature must stay: ({ blocks, context? }) => JSX.
 */
export interface DemoFormState {
  status: 'idle' | 'success' | 'error'
  message?: string
  /** Field name → error message. */
  fieldErrors?: Record<string, string>
}

export interface BlockContext {
  /** Draft previews tag sections with data-block-key so QA issues map to blocks. */
  preview?: boolean
  /** Server action wired by the site; DemoForm uses it with useActionState. */
  demoFormAction?: (prev: DemoFormState, formData: FormData) => Promise<DemoFormState>
  /** Cloudflare Turnstile site key; DemoForm renders the widget when set. */
  turnstileSiteKey?: string
}

export function BlockRenderer({ blocks, context }: { blocks: Block[]; context?: BlockContext }) {
  return (
    <>
      {blocks.map((b) => (
        <section
          key={b._key}
          data-block={b._type}
          data-block-key={context?.preview ? b._key : undefined}
        >
          <pre>{b._type}</pre>
        </section>
      ))}
    </>
  )
}
