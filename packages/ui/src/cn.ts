import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge needs to know the custom type sizes, otherwise it treats
 * `text-heading` as a colour and drops it when a `text-fg` follows.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'xs',
            'sm',
            'base',
            'lead',
            'title',
            'heading',
            'heading-sm',
            'display',
            'display-sm',
            'lg',
            'xl',
          ],
        },
      ],
    },
  },
})

/** Merge Tailwind classes, letting later utilities override earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
