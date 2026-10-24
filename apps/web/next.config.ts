import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@pageforge/ui', '@pageforge/blocks', '@pageforge/agents', '@pageforge/qa'],
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
