import type { Decorator, Preview } from '@storybook/react-vite'
import { useEffect } from 'react'
import './storybook.css'

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as 'light' | 'dark' | undefined) ?? 'light'
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  return <Story />
}

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Colour theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    options: {
      storySort: {
        order: ['Overview', 'Primitives', 'Chrome', 'Signature', 'Blocks', 'Pages'],
      },
    },
  },
}

export default preview
