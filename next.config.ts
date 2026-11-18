import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  poweredByHeader: false,
};

export default nextConfig;

// Supaya `next dev` bisa memakai binding D1 lokal (miniflare) seperti di Workers.
initOpenNextCloudflareForDev();
