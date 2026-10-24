import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  typescript: { reactDocgen: false },
  async viteFinal(config) {
    config.plugins = [...(config.plugins ?? []), tailwindcss()]
    // GitHub Pages serves the build from /<repo>/; relative asset paths work anywhere.
    config.base = './'
    return config
  },
}

export default config
